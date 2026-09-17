import test from 'node:test';
import assert from 'node:assert/strict';
import {fitPixels,PIXEL,WIDTH,HEIGHT} from '../src/index.mjs';
test('common displays get whole pixels close to the right shape',()=>{
 assert.deepEqual(fitPixels(1920,1080).pixel,{x:8,y:5},'1080p takes the exact 8 by 5 pixel');
 assert.equal(fitPixels(1920,1080).error,0);
 // Insisting on multiples of 8 by 5 would leave 1440p and 4K on 1280 by 960.
 assert.deepEqual(fitPixels(2560,1440).pixel,{x:11,y:7});
 assert.deepEqual(fitPixels(3840,2160).pixel,{x:18,y:11});
 for(const [w,h] of [[2560,1440],[3840,2160]])assert.ok(fitPixels(w,h).error<.03,'and the shape stays within 3%');
});
test('the picture always fits inside the box in whole pixels',()=>{
 for(let width=200;width<=4000;width+=137)for(let height=180;height<=2400;height+=91){
  const found=fitPixels(width,height);
  assert.ok(Number.isInteger(found.pixel.x)&&found.pixel.x>=1,`bad x at ${width}x${height}`);
  assert.ok(Number.isInteger(found.pixel.y)&&found.pixel.y>=1,`bad y at ${width}x${height}`);
  assert.equal(found.width,WIDTH*found.pixel.x);
  assert.equal(found.height,HEIGHT*found.pixel.y);
  // Only a box too small for one whole frame may overflow it.
  if(width>=WIDTH&&height>=HEIGHT){
   assert.ok(found.width<=width,`too wide at ${width}x${height}`);
   assert.ok(found.height<=height,`too tall at ${width}x${height}`);
  }
 }
});
test('a box that holds no well-shaped size takes the nearest instead of collapsing',()=>{
 // 640 by 480 has no whole-pixel size within 5%: 3 by 2 is the closest at 6.2%.
 const found=fitPixels(640,480);
 assert.deepEqual(found.pixel,{x:3,y:2});
 assert.equal(found.exact,false,'and it says the shape is off');
 assert.ok(found.width*found.height>WIDTH*HEIGHT*4,'far better than giving up and drawing it small');
});
test('tolerance trades shape against how much screen is used',()=>{
 const strict=fitPixels(1280,800),loose=fitPixels(1280,800,{tolerance:.08});
 assert.ok(loose.width*loose.height>strict.width*strict.height,'a wider tolerance fills more');
 assert.ok(loose.error>strict.error,'and costs shape to do it');
 assert.ok(strict.error<=.05&&loose.error<=.08);
 assert.throws(()=>fitPixels(0,100),/positive width and height/);
 assert.throws(()=>fitPixels(100,-1),/positive width and height/);
});
test('the base pixel is the 8 by 5 that makes a 4:3 picture',()=>{
 assert.deepEqual({...PIXEL},{x:8,y:5});
 assert.equal((WIDTH*PIXEL.x)/(HEIGHT*PIXEL.y),4/3);
});
