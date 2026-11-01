import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, readSave, normalize, writeSave } from '../js/storage.js';
test('missing or corrupt preferences use safe defaults', () => {
 for (const raw of [null, '{broken', 'null', '42']) assert.deepEqual(readSave({getItem:()=>raw}),defaults);
});
test('saved game progress is never persisted or restored', () => {
 assert.deepEqual(normalize({sound:'yes',reducedMotion:1,speed:'invalid',completed:true}),defaults);
 assert.deepEqual(normalize({speed:'instant',completed:true}),{...defaults,speed:'instant'});
});
test('unavailable storage is nonfatal', () => {
 assert.deepEqual(readSave({getItem(){throw Error('blocked');}}),defaults);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('blocked');}});
 assert.deepEqual(readSave(),defaults);
 assert.equal(writeSave(defaults),false);
 delete globalThis.localStorage;
});
test('only settings survive a round trip',()=>{
 let saved;
 globalThis.localStorage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
 const value={sound:true,reducedMotion:true,speed:'fast'};
 assert.equal(writeSave({...value,completed:true}),true);
 assert.deepEqual(readSave(),value);
 assert.equal(Object.hasOwn(JSON.parse(saved),'completed'),false);
 delete globalThis.localStorage;
});
