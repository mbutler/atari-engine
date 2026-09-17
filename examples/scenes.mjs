import {VCSFrame,HEIGHT} from '../src/index.mjs';
export const sprites={tank:[0x7c,0x7c,0x38,0x3f,0x38,0x7c,0x7c],beast:[0x0c,0x1e,0x12,0x0e,0x04,0x0c,0x1c,0x3c,0x3c,0x18,0x08,0x18,0x30,0x3c],key:[0x60,0x90,0x90,0x60,0x20,0x20,0x38,0x28],
 drone:[0x24,0x7e,0xdb,0xff,0xbd,0xa5,0x24,0x42],husk:[0x18,0x3c,0x7e,0xdb,0xff,0x24,0x66,0xc3],
 spire:[0x81,0x42,0x7e,0xdb,0xff,0xbd,0x81,0x5a],cannon:[0x18,0x18,0x3c,0x7e,0xff,0xff,0xe7,0xc3]};
const full='11111111111111111111',edge='10000000000000000000';
export function arena(){const f=new VCSFrame().clear(0x1c);f.number(1,{x:39,y:5,color:0x56,digits:1,scaleX:3,scaleY:3});f.number(0,{x:113,y:5,color:0x76,digits:1,scaleX:3,scaleY:3});f.playfield(full,{y:25,height:7,color:0x4c});f.playfield(edge,{y:32,height:152,color:0x4c});f.playfield(full,{y:184,height:8,color:0x4c});f.playfield('10000000111000000000',{y:62,height:9,color:0x4c});f.playfield('10000000100000000000',{y:71,height:31,color:0x4c});f.playfield('10000000000000011111',{y:135,height:8,color:0x4c});f.sprite(sprites.tank,{x:18,y:112,color:0x76});f.sprite(sprites.tank,{x:111,y:93,color:0x56,reflect:true});f.missile(44,118,{width:2,height:3,color:0x76});return f;}
export function room(){const f=new VCSFrame().clear(0x0a);f.playfield('11111111111111110000',{y:0,height:16,color:0x16});f.playfield(full,{y:176,height:16,color:0x16});f.playfield('10000000000000000000',{y:16,height:56,color:0x16});f.playfield('10000000000000000000',{y:120,height:56,color:0x16});f.missile(62,115,{width:4,height:8,color:0x16});f.sprite(sprites.key,{x:69,y:112,color:0x1c});f.sprite(sprites.beast,{x:107,y:56,color:0x1c});return f;}
// Exercises the 0.2 primitives. Each row is six abreast from two registers:
// three copies apiece at 32 clocks, interleaved 16 apart, so the pitch is even and
// the scanline still costs only the two objects the hardware has. Every creature in
// a row is necessarily identical, since copies are one register. The sky is a single
// hue walked down its luminance ramp, one color per scanline.
export function invaders(){
 const f=new VCSFrame();
 f.scanlines(0,HEIGHT,line=>0x90+(Math.min(4,Math.floor(line*5/HEIGHT))<<1));
 f.number(1240,{x:8,y:8,digits:4,color:0x0e,scaleX:2,scaleY:3});
 for(const [y,art,color] of [[40,sprites.spire,0x5a],[60,sprites.drone,0xac],[80,sprites.husk,0x1c],[100,sprites.drone,0xbc]]){
  f.sprite(art,{x:36,y,color,copies:3,spacing:32});
  f.sprite(art,{x:52,y,color,copies:3,spacing:32});
 }
 f.playfield('00011100000111000000',{y:128,height:8,color:0xc6});
 f.playfield('00010100000101000000',{y:136,height:5,color:0xc6});
 f.missile(60,118,{width:1,height:5,color:0x46});
 f.missile(79,144,{width:1,height:6,color:0x0e});
 f.sprite(sprites.cannon,{x:76,y:160,color:0x0e});
 return f;
}
