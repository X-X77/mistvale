// Hand-authored integer pixel clusters, not resized or mosaicked source art.
import fs from 'node:fs/promises';
import zlib from 'node:zlib';
const out = new URL('../assets/characters/sprite-test/', import.meta.url);
const P={o:'#392d31',skin:'#efc6a6',light:'#ffe0bd',shade:'#c78f7d',blush:'#d9a090',cream:'#e9dbb9',cs:'#b7a98b',cl:'#fff0d1',green:'#85886a',gs:'#585f50',gl:'#a8aa83',brown:'#795848',bs:'#513c35',bl:'#a17b5d',gold:'#c2a06a',eye:'#87986c',white:'#f8e7ce',book:'#863e3d',booklight:'#b35d4b'};
class Canvas{
 constructor(w,h){this.w=w;this.h=h;this.data=new Uint8Array(w*h*4)}
 pixel(x,y,c){if(x<0||y<0||x>=this.w||y>=this.h)return;let k=(y*this.w+x)*4;let h=(P[c]||c).slice(1);this.data.set([parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16),255],k)}
 rect(x,y,w,h,c){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)this.pixel(i,j,c)}
 poly(points,c){for(let y=0;y<this.h;y++)for(let x=0;x<this.w;x++){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){let [a,b]=points[i],[u,v]=points[j];if(((b>y)!=(v>y))&&(x<(u-a)*(y-b)/(v-b)+a))inside=!inside}if(inside)this.pixel(x,y,c)}}
 line(x,y,a,b,c){let n=Math.max(Math.abs(a-x),Math.abs(b-y));for(let i=0;i<=n;i++)this.pixel(Math.round(x+(a-x)*i/n),Math.round(y+(b-y)*i/n),c)}
 stamp(src,x,y,s=1){for(let j=0;j<src.h;j++)for(let i=0;i<src.w;i++){let k=(j*src.w+i)*4;if(src.data[k+3])this.rect(x+i*s,y+j*s,s,s,'#'+Array.from(src.data.slice(k,k+3)).map(v=>v.toString(16).padStart(2,'0')).join(''))}}
}
function head(c,male){
 c.poly([[38,16],[54,16],[59,22],[58,33],[54,39],[47,41],[40,37],[36,29]],'o');
 c.poly([[39,18],[53,18],[57,23],[56,33],[52,38],[47,39],[41,35],[38,28]],'skin');
 c.poly([[41,20],[53,20],[55,24],[54,32],[49,37],[43,34],[40,29]],'light');
 c.rect(37,27,3,6,'shade');c.rect(56,26,3,6,'shade');c.rect(57,27,1,3,'skin');
 c.line(41,28,45,28,'o');c.line(50,28,54,28,'o');
 c.rect(42,29,3,3,male?'green':'eye');c.rect(51,29,3,3,male?'green':'eye');c.pixel(42,29,'white');c.pixel(51,29,'white');c.pixel(44,30,'o');c.pixel(53,30,'o');
 c.rect(40,33,3,1,'blush');c.rect(53,33,2,1,'blush');c.pixel(48,33,'shade');c.line(46,36,50,36,'shade');c.pixel(50,35,'shade');
}
function edelin(){let c=new Canvas(96,96);
 // Long ash-brown hair, continuous silhouette behind cardigan.
 c.poly([[43,9],[53,9],[59,12],[63,18],[63,36],[66,47],[65,58],[69,65],[62,68],[59,60],[35,65],[29,61],[32,50],[32,20],[36,13]],'o');
 c.poly([[43,10],[53,10],[59,14],[62,20],[61,38],[64,49],[62,58],[66,63],[61,64],[57,57],[35,62],[31,60],[35,46],[34,22],[38,15]],'#967e72');
 c.poly([[38,18],[43,13],[48,12],[44,34],[40,50],[35,58],[36,36]],'#b69b88');
 c.line(60,24,59,51,'brown');c.line(62,41,63,58,'brown');c.line(36,36,33,57,'brown');
 // Shoes and skirt share the y=88 ground line with Rowen.
 c.rect(38,82,10,7,'o');c.rect(51,82,10,7,'o');c.rect(39,83,8,4,'brown');c.rect(52,83,8,4,'brown');c.rect(39,85,6,1,'bl');c.rect(52,85,6,1,'bl');
 c.poly([[39,55],[56,55],[59,68],[64,83],[59,86],[35,86],[32,83],[36,67]],'o');
 c.poly([[40,57],[55,57],[58,70],[62,82],[57,84],[36,84],[34,82],[38,68]],'brown');
 c.poly([[42,59],[46,59],[43,83],[37,83]],'bl');c.poly([[49,59],[52,59],[57,84],[49,84]],'#96705a');c.line(47,63,46,82,'bs');c.line(54,65,58,82,'bs');
 c.poly([[38,39],[45,37],[53,37],[59,40],[63,53],[60,64],[55,66],[51,58],[42,59],[38,65],[32,61],[31,52],[34,43]],'o');
 c.poly([[37,41],[44,39],[54,39],[59,43],[61,53],[58,62],[55,63],[51,56],[42,57],[37,62],[33,59],[33,51]],'green');
 c.poly([[43,39],[48,41],[53,39],[55,48],[42,49]],'cream');c.line(44,40,47,43,'cl');c.line(52,40,49,43,'cl');c.rect(47,42,3,3,'gold');c.line(47,45,45,49,'book');c.line(49,45,52,48,'book');
 c.poly([[35,44],[39,42],[38,53],[35,56],[34,53]],'gl');c.poly([[56,43],[59,46],[59,54],[56,58],[52,54]],'gl');c.line(34,58,38,60,'gs');c.line(56,60,59,57,'gs');
 // Book and folded hands, readable at native size.
 c.poly([[40,48],[54,49],[55,62],[41,61]],'o');c.poly([[41,49],[53,50],[54,60],[42,59]],'book');c.line(42,50,52,51,'cream');c.line(43,52,52,53,'booklight');c.line(42,53,43,58,'booklight');
 c.poly([[36,54],[40,53],[44,55],[44,58],[40,59],[36,57]],'shade');c.poly([[36,54],[40,54],[43,55],[42,57],[38,57]],'light');
 c.poly([[53,55],[56,56],[55,59],[49,60],[46,58],[47,56]],'skin');c.line(48,57,53,57,'light');
 head(c,false);
 // Front hair clusters retain center-part sweep and small side braid.
 c.poly([[35,24],[36,17],[42,12],[51,11],[58,15],[61,22],[58,28],[54,24],[51,18],[49,26],[46,25],[44,19],[43,27],[40,26],[39,22],[38,29]],'o');
 c.poly([[36,23],[38,17],[43,13],[51,12],[57,16],[59,22],[57,25],[53,21],[51,16],[49,24],[47,23],[44,16],[42,25],[40,24],[39,20],[38,25]],'#aa8f7e');
 c.line(42,15,39,21,'#c6aa96');c.line(46,14,48,21,'#c6aa96');c.line(53,15,57,20,'#c6aa96');
 for(let y=24;y<41;y+=4){c.rect(58,y,3,3,'brown');c.rect(59,y,2,2,'#b69b88')}
 c.line(37,30,36,43,'#b69b88');c.line(59,36,60,46,'#b69b88');return c;
}
function rowen(){let c=new Canvas(96,96);
 // Trouser legs, leather shoes, apron and rolled cream sleeves.
 c.poly([[38,60],[58,60],[59,79],[61,84],[61,89],[50,89],[49,72],[46,72],[45,89],[34,89],[34,85],[37,80]],'o');
 c.rect(38,65,8,17,'brown');c.rect(50,65,8,17,'brown');c.line(39,67,38,80,'bl');c.line(54,69,55,81,'bs');c.rect(35,84,9,3,'bs');c.rect(51,84,9,3,'bs');c.line(36,84,42,84,'bl');c.line(52,84,58,84,'bl');
 c.poly([[38,39],[44,37],[52,37],[60,40],[64,46],[65,58],[60,64],[36,63],[31,56],[29,45]],'o');
 c.poly([[34,42],[41,40],[44,43],[39,57],[35,59],[32,54],[31,46]],'cream');c.poly([[56,41],[61,43],[63,48],[63,58],[59,60],[56,54]],'cream');
 c.line(33,45,33,52,'cl');c.line(60,45,61,51,'cl');c.line(34,49,36,52,'cs');c.line(59,49,61,52,'cs');c.rect(58,54,6,3,'cs');c.rect(58,54,6,1,'cl');
 c.poly([[40,40],[45,39],[48,45],[52,39],[57,41],[59,59],[55,65],[38,64],[37,57]],'gs');
 c.poly([[41,41],[45,41],[48,47],[52,41],[56,43],[57,58],[54,62],[40,62],[39,56]],'green');
 c.poly([[41,40],[45,38],[48,43],[45,47]],'cl');c.poly([[49,43],[52,38],[56,40],[52,46]],'cream');c.line(48,46,47,61,'gs');c.line(41,51,40,58,'gl');c.line(51,49,55,48,'gl');
 for(let y=49;y<61;y+=5)c.pixel(48,y,'gold');
 c.poly([[38,63],[56,63],[56,78],[39,78]],'bs');c.rect(40,64,14,13,'brown');c.line(40,64,54,64,'gold');c.rect(42,69,11,7,'bs');c.rect(43,70,9,4,'bl');c.rect(46,67,3,4,'cream');c.rect(49,68,3,3,'booklight');c.pixel(42,70,'gold');c.pixel(52,70,'gold');
 // Welcoming open hand, other relaxed at apron edge.
 c.poly([[31,51],[35,53],[35,57],[31,59],[25,56],[25,52],[27,51],[29,54]],'o');
 c.poly([[31,53],[34,54],[33,56],[30,57],[26,55],[26,53],[28,55],[30,55]],'skin');c.line(27,54,30,56,'light');
 c.poly([[59,57],[63,58],[62,65],[59,68],[56,65]],'o');c.poly([[60,58],[62,59],[61,64],[59,66],[58,64]],'skin');c.rect(58,58,4,2,'gold');c.pixel(60,58,'white');
 head(c,true);
 c.poly([[35,28],[33,22],[35,16],[39,13],[38,9],[44,11],[48,9],[55,12],[59,16],[61,23],[57,30],[55,23],[51,20],[48,27],[45,28],[46,21],[41,25],[40,29],[38,26]],'o');
 c.poly([[36,24],[35,21],[38,16],[41,14],[41,11],[45,13],[49,11],[54,14],[57,18],[59,23],[57,26],[54,21],[51,16],[48,24],[47,25],[48,18],[42,22],[40,26],[39,23]],'#594432');
 c.pixel(48,9,'o');c.line(42,14,38,20,'#806044');c.line(46,14,44,20,'#806044');c.line(51,13,55,18,'#806044');c.pixel(52,14,'#a07b54');c.line(56,18,58,22,'#72543d');return c;
}
function crc32(b){let c=0xffffffff;for(let n of b){c^=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1}return(c^0xffffffff)>>>0}
function chunk(type,data){let t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc])}
function png(c){let hdr=Buffer.alloc(13);hdr.writeUInt32BE(c.w);hdr.writeUInt32BE(c.h,4);hdr[8]=8;hdr[9]=6;let rows=[];for(let y=0;y<c.h;y++)rows.push(Buffer.from([0]),Buffer.from(c.data.slice(y*c.w*4,(y+1)*c.w*4)));return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',zlib.deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))])}
await fs.mkdir(out,{recursive:true});const e=edelin(),r=rowen();
for(let [name,c]of[['edelin',e],['rowen',r]])await fs.writeFile(new URL(name+'_sprite.png',out),png(c));
let sheet=new Canvas(768,432);for(let y=0;y<432;y+=16)for(let x=0;x<768;x+=16)sheet.rect(x,y,16,16,((x+y)/16)%2?'#303934':'#354039');sheet.stamp(e,0,12,4);sheet.stamp(r,384,12,4);sheet.line(24,368,744,368,'#ad9871');await fs.writeFile(new URL('comparison-4x.png',out),png(sheet));
console.log('Wrote two 96×96 RGBA sprites and nearest-neighbor comparison.');
