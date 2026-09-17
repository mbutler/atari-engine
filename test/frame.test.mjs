import test from 'node:test';
import assert from 'node:assert/strict';
import {VCSFrame,PALETTE,TIA_BUDGET,UNLIMITED,greyscale} from '../src/index.mjs';
test('playfield cells are four pixels wide and reflect at the midpoint',()=>{const f=new VCSFrame().clear();f.playfield('01000000000000000000',{y:10,height:2,color:0x0e});assert.deepEqual([...f.pixels.slice(1600,1760)].flatMap((v,i)=>v?[i]:[]),[4,5,6,7,152,153,154,155]);assert.equal(f.pixels[12*160+4],0);});
test('repeat uses original order and asymmetric accepts independent halves',()=>{const f=new VCSFrame().clear();f.playfield('01000000000000000000',{mode:'repeat',height:1});assert.equal(f.pixels[84],0x0e);assert.equal(f.pixels[152],0);f.clear().playfield('1'.padEnd(40,'0'),{mode:'asymmetric',height:1});assert.equal(f.pixels[0],0x0e);assert.equal(f.pixels[159],0);});
test('sprites reflect bits, stretch horizontally and change color by row',()=>{const f=new VCSFrame().clear();f.sprite([128,1],{x:10,y:10,reflect:true,stretch:2,lineHeight:3,colors:[0x46,0x96]});assert.equal(f.pixels[10*160+24],0x46);assert.equal(f.pixels[12*160+25],0x46);assert.equal(f.pixels[13*160+10],0x96);assert.equal(f.pixels[13*160+24],0);});
test('invalid patterns, palettes, fractional positions and scales fail explicitly',()=>{const f=new VCSFrame();assert.throws(()=>f.playfield('110'));assert.throws(()=>f.sprite([256]));assert.throws(()=>f.sprite([128],{x:1.5}));assert.throws(()=>f.clear(0xff));assert.throws(()=>f.rgba(0,1));});
test('clipping cannot wrap pixels into another row',()=>{const f=new VCSFrame().clear();f.sprite([255],{x:158,y:0});assert.equal(f.pixels[159],0x0e);assert.equal(f.pixels[160],0);});
test('display expands each logical pixel exactly 8 by 5 with no blended colors',()=>{const f=new VCSFrame().clear();f.missile(0,0,{color:0x0e,height:1});const out=f.rgba();assert.equal(out.width/out.height,4/3);assert.deepEqual([...out.data.slice(7*4,8*4)],[236,236,236,255]);assert.deepEqual([...out.data.slice(8*4,9*4)],[0,0,0,255]);assert.deepEqual([...out.data.slice(5*out.width*4,5*out.width*4+4)],[0,0,0,255]);});
test('the palette covers every hue and luminance the hardware addresses',()=>{
 assert.equal(Object.keys(PALETTE).length,128);
 for(let hue=0;hue<16;hue++)for(let luma=0;luma<8;luma++)assert.ok(Object.hasOwn(PALETTE,(hue<<4)|(luma<<1)),`missing $${((hue<<4)|(luma<<1)).toString(16)}`);
 // Bit 0 is ignored by the TIA, so odd codes stay unconfigured.
 assert.throws(()=>new VCSFrame().clear(0x01));
 // Every hue must brighten as the luminance nibble rises, or ramps are unusable.
 const luminance=hex=>.299*parseInt(hex.slice(1,3),16)+.587*parseInt(hex.slice(3,5),16)+.114*parseInt(hex.slice(5,7),16);
 for(let hue=0;hue<16;hue++)for(let luma=1;luma<8;luma++)
  assert.ok(luminance(PALETTE[(hue<<4)|(luma<<1)])>luminance(PALETTE[(hue<<4)|((luma-1)<<1)]),`hue ${hue} does not rise at luma ${luma}`);
 // The colors the 0.1 examples were composed against are preserved exactly.
 assert.equal(PALETTE[0x0e],'#ececec');assert.equal(PALETTE[0x1c],'#e8e85c');assert.equal(PALETTE[0x46],'#b03c3c');
});
test('scanlines set one background color per line and skip where none is given',()=>{
 const f=new VCSFrame().clear();
 f.scanlines(4,3,(line,offset)=>offset===1?null:line===4?0x02:0x06);
 assert.equal(f.pixels[4*160],0x02);
 assert.equal(f.pixels[5*160],0);           // null left the line alone
 assert.equal(f.pixels[6*160+159],0x06);    // and the band spans the full width
 assert.equal(f.pixels[7*160],0);
 // Lines outside the frame are dropped rather than wrapping.
 f.scanlines(190,6,()=>0x0e);
 assert.equal(f.pixels[191*160],0x0e);
 assert.throws(()=>f.scanlines(0,4,0x0e));
});
test('the object budget counts per scanline, and reuse further down is free',()=>{
 const f=new VCSFrame().clear();
 f.sprite([255],{x:0,y:10});f.sprite([255],{x:20,y:10});
 // A third player on the same scanline is more than the TIA can place.
 const before=f.pixels.slice();
 assert.throws(()=>f.sprite([255],{x:40,y:10}),/Scanline 10 would need 3 sprites/);
 assert.deepEqual([...f.pixels],[...before],'a rejected draw must not touch the frame');
 f.sprite([255],{x:40,y:40});                 // same objects, lower down: allowed
 assert.equal(f.pixels[40*160+40],0x0e);
 f.missile(0,10,{height:2});f.missile(4,10,{height:2});f.missile(8,10,{height:2});
 assert.throws(()=>f.missile(12,10,{height:2}),/4 missiles/);
});
test('the budget is a default, not a cage',()=>{
 const raised=new VCSFrame(PALETTE,{budget:{...TIA_BUDGET,sprites:4}});
 for(const x of [0,20,40,60])raised.sprite([255],{x,y:0});
 assert.equal(raised.stats().sprites,4);
 assert.throws(()=>raised.sprite([255],{x:80,y:0}),/allows 4/);
 const free=new VCSFrame(PALETTE,{budget:UNLIMITED});
 for(let i=0;i<12;i++)free.sprite([255],{x:i*8,y:0});
 assert.equal(free.stats().sprites,12);
 const off=new VCSFrame(PALETTE,{budget:null});
 for(let i=0;i<12;i++)off.sprite([255],{x:i*8,y:0});
 assert.equal(off.stats().sprites,12);
});
test('scores clamp to their digit count instead of overflowing the layout',()=>{
 const wide=new VCSFrame().clear().number(1234,{digits:2,x:0,y:0});
 const narrow=new VCSFrame().clear().number(34,{digits:2,x:0,y:0});
 assert.deepEqual([...wide.pixels],[...narrow.pixels]);
});
test('repeated players share one bitmap at fixed spacing',()=>{
 const f=new VCSFrame().clear();
 f.sprite([255],{x:10,y:0,copies:3,spacing:32,color:0x46});
 for(const left of [10,42,74])for(let i=0;i<8;i++)assert.equal(f.pixels[left+i],0x46,`copy at ${left} is incomplete`);
 assert.equal(f.pixels[18],0);   // the gap between copies stays empty
 assert.equal(f.commands.at(-1).width,(3-1)*32+8);
 // Reflection and per-row color belong to the register, so every copy shares them.
 const g=new VCSFrame().clear();
 g.sprite([128,1],{x:0,y:0,copies:2,spacing:16,reflect:true,colors:[0x46,0x96]});
 assert.equal(g.pixels[7],0x46);assert.equal(g.pixels[23],0x46);
 assert.equal(g.pixels[2*160+0],0x96);assert.equal(g.pixels[2*160+16],0x96);
 // Copies past the right edge clip rather than wrapping.
 const h=new VCSFrame().clear();
 h.sprite([255],{x:120,y:0,copies:3,spacing:32});
 assert.equal(h.pixels[159],0x0e);assert.equal(h.pixels[160],0);
});
test('copies cost one player, so two registers still fill a scanline',()=>{
 const f=new VCSFrame().clear();
 f.sprite([255],{x:0,y:20,copies:3,spacing:16});
 f.sprite([255],{x:80,y:20,copies:3,spacing:16});
 assert.equal(f.stats().sprites,2);   // six objects drawn from two registers
 assert.throws(()=>f.sprite([255],{x:140,y:20}),/Scanline 20 would need 3 sprites/);
});
test('copy settings the hardware has no register for are refused',()=>{
 const f=new VCSFrame().clear();
 assert.throws(()=>f.sprite([255],{copies:4}),/must be 1, 2 or 3/);
 assert.throws(()=>f.sprite([255],{copies:3,spacing:64}),/only at 16 or 32/);
 assert.throws(()=>f.sprite([255],{copies:2,stretch:2}),/repeated or stretched/);
 assert.throws(()=>f.sprite([255],{copies:2,spacing:24}),/16, 32 or 64/);
 // A single copy is unaffected: stretch still works and spacing is irrelevant.
 f.sprite([255],{x:0,y:0,stretch:4});
 assert.equal(f.commands.at(-1).width,32);
 assert.equal(f.commands.at(-1).copies,1);
});
test('collision is pixel exact, not by bounding box',()=>{
 const f=new VCSFrame().clear();
 // Identical bounding boxes, interleaved pixels: nothing actually touches.
 f.sprite([0xaa],{x:0,y:0,id:'a'});
 f.sprite([0x55],{x:0,y:0,id:'b'});
 assert.equal(f.hit('a','b'),false);
 assert.deepEqual(f.collisions(),[]);
 // Shift by one pixel and they interlock.
 f.clear().sprite([0xaa],{x:0,y:0,id:'a'}).sprite([0x55],{x:1,y:0,id:'b'});
 assert.equal(f.hit('a','b'),true);
});
test('overlap is latched whatever the draw order, even when painted over',()=>{
 const f=new VCSFrame().clear();
 // Two players and a missile stacked on one spot, which the budget does allow.
 f.sprite([255],{x:0,y:0,id:'under'});
 f.sprite([255],{x:0,y:0,id:'middle'});
 f.missile(0,0,{id:'over'});
 // The last draw owns the pixels, but every pair that met is still reported.
 assert.deepEqual(f.collisions(),[['middle','over'],['middle','under'],['over','under']]);
 assert.equal(f.hit('under','over'),true);
});
test('draws sharing an id are one object, as a reused register is',()=>{
 const f=new VCSFrame().clear();
 f.playfield('11110000000000000000',{y:0,height:8,color:0xc6,id:'pf'});
 f.playfield('11110000000000000000',{y:40,height:8,color:0xc6,id:'pf'});
 f.sprite([255],{x:0,y:40,id:'ball'});
 assert.deepEqual(f.hit('ball'),['pf']);   // one object, one report
 assert.equal(f.slots.length,2);
 // Copies of one sprite never collide with themselves.
 f.clear().sprite([255],{x:0,y:0,copies:3,spacing:16,id:'row'});
 assert.deepEqual(f.collisions(),[]);
});
test('the background is not an object and untagged draws are not tracked',()=>{
 const f=new VCSFrame().clear(0x46);
 f.scanlines(0,20,()=>0x1c);
 f.sprite([255],{x:0,y:0,id:'ship'});
 assert.deepEqual(f.collisions(),[],'filled pixels behind an object are not a collision');
 f.sprite([255],{x:0,y:0});                 // no id: invisible to collision
 assert.deepEqual(f.collisions(),[]);
 // A frame that never tags anything allocates no occupancy buffer at all.
 const plain=new VCSFrame().clear();
 plain.sprite([255],{x:0,y:0});
 assert.equal(plain.occupancy,null);
});
test('clearing the frame clears the latched collisions',()=>{
 const f=new VCSFrame().clear();
 f.sprite([255],{x:0,y:0,id:'a'}).sprite([255],{x:0,y:0,id:'b'});
 assert.equal(f.hit('a','b'),true);
 f.clear();
 assert.deepEqual(f.collisions(),[]);
 assert.equal(f.hit('a','b'),false);
 assert.deepEqual(f.hit('nothing'),[]);
 assert.throws(()=>f.sprite([255],{id:''}),/non-empty string/);
});
test('blit fills an existing buffer identically to the allocating path',()=>{
 const f=new VCSFrame().clear(0x46);
 f.playfield('10101010101010101010',{y:0,height:9,color:0x1c}).sprite([255],{x:3,y:2,color:0x8c});
 const buffer=new Uint8ClampedArray(160*192*4);
 f.blit(buffer);
 assert.deepEqual([...buffer],[...f.rgba(1,1).data]);
 assert.throws(()=>f.blit(new Uint8ClampedArray(16)),/RGBA bytes/);
});
test('greyscale keeps the luminance and drops the hue, as the color switch does',()=>{
 for(const code of Object.keys(PALETTE).map(Number)){
  const grey=greyscale(code);
  assert.ok(Object.hasOwn(PALETTE,grey),`$${code.toString(16)} greyed to an unconfigured color`);
  assert.equal(grey>>4,0,'greyscale must land on the grey ladder');
  assert.equal(grey&0x0e,code&0x0e,'luminance must survive');
  const [r,g,b]=[1,3,5].map(i=>parseInt(PALETTE[grey].slice(i,i+2),16));
  assert.ok(r===g&&g===b,`$${grey.toString(16)} is not neutral`);
 }
});
