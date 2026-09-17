import {WIDTH,HEIGHT} from './frame.mjs';
// The 2600 pixel is not square: eight colour clocks across by five scanlines is what
// makes the 4:3 image. Exact 8 by 5 expansion preserves the approved picture.
export const PIXEL=Object.freeze({x:8,y:5});
// The largest whole-pixel size of the frame that fits inside a box.
//
// What stops a scaled picture shimmering is that every pixel is the same size, not
// that the shape is exactly 4:3, so this searches whole pixel sizes within `tolerance`
// of the right shape rather than insisting on multiples of 8 by 5. Insisting costs a
// lot of screen: on a 2560 by 1440 display the nearest 8 by 5 multiple is still
// 1280 by 960 and wastes two thirds of the panel, while 11 by 7 pixels fills 1760 by
// 1344 at a shape 1.8% off square, which nobody can see.
export function fitPixels(width,height,{tolerance=.05}={}){
 if(!(width>0&&height>0))throw new RangeError('A display box needs a positive width and height');
 const want=(WIDTH*PIXEL.x)/(HEIGHT*PIXEL.y);
 let best=null,closest=null;
 for(let y=1;y*HEIGHT<=height;y++)for(let x=1;x*WIDTH<=width;x++){
  const error=Math.abs((WIDTH*x)/(HEIGHT*y)-want)/want;
  if(error<=tolerance&&(!best||x*y>best.x*best.y))best={x,y,error};
  if(!closest||error<closest.error||(error===closest.error&&x*y>closest.x*closest.y))closest={x,y,error};
 }
 // Tolerance is a preference, not a rule. Some boxes hold no whole-pixel size of the
 // right shape at all, and the nearest shape that does fit beats refusing to scale.
 const chosen=best||closest||{x:1,y:1,error:0};
 return {pixel:{x:chosen.x,y:chosen.y},width:WIDTH*chosen.x,height:HEIGHT*chosen.y,
         shape:(WIDTH*chosen.x)/(HEIGHT*chosen.y),error:chosen.error,exact:chosen.error<=tolerance};
}
// `fit` is 'fixed' for a canvas the page sizes itself, or 'integer' to keep the canvas
// at the largest whole-pixel size its container allows, recomputed as that changes.
// 'integer' also drives fullscreen, where the container becomes the screen and the
// bars around the picture take the `background` colour.
export function createDisplay(canvas,{fit='fixed',within=null,background='#000',tolerance=.05}={}){
 if(!['fixed','integer'].includes(fit))throw new RangeError("Display fit must be 'fixed' or 'integer'");
 const owner=canvas.ownerDocument,view=owner.defaultView;
 const buffer=owner.createElement('canvas');buffer.width=WIDTH;buffer.height=HEIGHT;
 const source=buffer.getContext('2d'),target=canvas.getContext('2d');
 const image=source.createImageData(WIDTH,HEIGHT);
 const host=()=>within||canvas.parentElement||canvas;
 let pixel={...PIXEL},observer=null;
 // Resizing a canvas resets its context, so smoothing is turned off again each time.
 const measure=()=>{
  if(fit==='fixed'){canvas.width=WIDTH*PIXEL.x;canvas.height=HEIGHT*PIXEL.y;target.imageSmoothingEnabled=false;return;}
  const ratio=view&&view.devicePixelRatio||1,box=host().getBoundingClientRect();
  const found=fitPixels(Math.max(WIDTH,Math.floor(box.width*ratio)),Math.max(HEIGHT,Math.floor(box.height*ratio)),{tolerance});
  pixel=found.pixel;
  canvas.width=found.width;canvas.height=found.height;
  // Backing store in device pixels, CSS box in CSS pixels: one canvas pixel per
  // device pixel, so nothing is resampled on the way to the screen.
  canvas.style.width=`${found.width/ratio}px`;canvas.style.height=`${found.height/ratio}px`;
  target.imageSmoothingEnabled=false;
 };
 if(fit==='integer'){
  if(background)host().style.background=background;
  if(view&&view.ResizeObserver){observer=new view.ResizeObserver(measure);observer.observe(host());}
  else if(view)view.addEventListener('resize',measure);
  owner.addEventListener('fullscreenchange',measure);
 }
 measure();
 const display={
  present(frame){frame.blit(image.data);source.putImageData(image,0,0);target.drawImage(buffer,0,0,canvas.width,canvas.height);},
  resize:measure,
  get pixel(){return {...pixel};},
  get size(){return {width:canvas.width,height:canvas.height};},
  get isFullscreen(){return owner.fullscreenElement===host();},
  fullscreen(on=true){
   if(!on)return owner.exitFullscreen?owner.exitFullscreen():Promise.resolve();
   const element=host();
   return element.requestFullscreen?element.requestFullscreen():Promise.reject(new Error('Fullscreen is unavailable here'));
  },
  toggleFullscreen(){return display.fullscreen(!display.isFullscreen);},
  destroy(){
   if(observer)observer.disconnect();
   if(view)view.removeEventListener('resize',measure);
   owner.removeEventListener('fullscreenchange',measure);
  },
 };
 return display;
}
