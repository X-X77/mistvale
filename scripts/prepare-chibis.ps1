param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies @('System.Drawing.Common','System.Drawing.Primitives','System.Private.Windows.Core','System.Private.Windows.GdiPlus','System.Runtime','System.Runtime.InteropServices') -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class ChibiPrep {
 public static string Process(string source,string target,bool remove) {
  using(var input=new Bitmap(source))using(var b=new Bitmap(input.Width,input.Height,PixelFormat.Format32bppArgb)){
   using(var g=Graphics.FromImage(b))g.DrawImageUnscaled(input,0,0);
   int threshold=source.Contains("사르칸")?215:238;int w=b.Width,h=b.Height; var d=b.LockBits(new Rectangle(0,0,w,h),ImageLockMode.ReadWrite,PixelFormat.Format32bppArgb);byte[] a=new byte[d.Stride*h];Marshal.Copy(d.Scan0,a,0,a.Length);
   bool[] seen=new bool[w*h];int[] q=new int[w*h];int tail=0,head=0,removed=0;
   // Remove only near-neutral bright BACKGROUND connected to a canvas edge.
   // No global white-key: enclosed white clothes, eyes and ornaments are retained.
   if(remove){
    for(int y=0;y<h;y++)for(int x=0;x<w;x++)if(x==0||y==0||x==w-1||y==h-1){int k=y*d.Stride+x*4;int lo=Math.Min(a[k],Math.Min(a[k+1],a[k+2])),hi=Math.Max(a[k],Math.Max(a[k+1],a[k+2]));if(lo>=threshold&&hi-lo<=30){int p=y*w+x;seen[p]=true;q[tail++]=p;}}
    while(head<tail){int p=q[head++],x=p%w,y=p/w;int k=y*d.Stride+x*4;a[k+3]=0;removed++;for(int i=0;i<4;i++){int nx=x+(i==0?-1:i==1?1:0),ny=y+(i==2?-1:i==3?1:0);if(nx<0||ny<0||nx>=w||ny>=h)continue;int np=ny*w+nx;if(seen[np])continue;int z=ny*d.Stride+nx*4;int lo=Math.Min(a[z],Math.Min(a[z+1],a[z+2])),hi=Math.Max(a[z],Math.Max(a[z+1],a[z+2]));if(lo>=threshold&&hi-lo<=30){seen[np]=true;q[tail++]=np;}}}
   }
   Marshal.Copy(a,0,d.Scan0,a.Length);b.UnlockBits(d);
   // Keep complete source bounds: clipped source anatomy is never reconstructed.
   int oh=560,ow=(int)Math.Round(w*560.0/h);
   using(var web=new Bitmap(ow,oh,PixelFormat.Format32bppArgb)){
    using(var g=Graphics.FromImage(web)){g.CompositingMode=System.Drawing.Drawing2D.CompositingMode.SourceCopy;g.InterpolationMode=System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;using(var ia=new ImageAttributes()){ia.SetWrapMode(System.Drawing.Drawing2D.WrapMode.TileFlipXY);g.DrawImage(b,new Rectangle(0,0,ow,oh),0,0,w,h,GraphicsUnit.Pixel,ia);}}
    web.Save(target,ImageFormat.Png);
   }
   return removed.ToString();
  }
 }
}
'@
$originals=Join-Path $ProjectRoot 'assets/characters/chibi-originals'
$web=Join-Path $ProjectRoot 'assets/characters/chibis'
[IO.Directory]::CreateDirectory($web) | Out-Null
$data=Get-Content (Join-Path $ProjectRoot 'assets/npc/characters.json') -Raw | ConvertFrom-Json
$report=@()
foreach($npc in $data.npc.PSObject.Properties){
 $id=$npc.Name;$name=$npc.Value.name;$file=$name+'_치비.png';$source=Join-Path $originals $file
 if(!(Test-Path -LiteralPath $source)){throw "Missing $file"}
 $retain=$name -in @('네리','루시엘','미엘','세레피나','세이라')
 $target=Join-Path $web ($id+'.png')
 $removed=[ChibiPrep]::Process($source,$target,!$retain)
 $report+=[PSCustomObject]@{id=$id;name=$name;placeId=$npc.Value.placeId;original=$file;src='./assets/characters/chibis/'+$id+'.png';background= $(if($retain){'original-preserved'}else{'edge-connected-neutral'});removedPixels=[int]$removed;bytes=(Get-Item $target).Length;sha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash}
}
$report | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $web 'asset-audit.json') -Encoding utf8
$report | Select-Object id,name,background,bytes

