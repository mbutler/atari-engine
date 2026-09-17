import {WIDTH,HEIGHT} from './frame.mjs';
// Reuses the staging canvas. Exact 8 by 5 expansion preserves the approved picture.
export function createDisplay(canvas){
 const buffer=canvas.ownerDocument.createElement('canvas');buffer.width=WIDTH;buffer.height=HEIGHT;
 const source=buffer.getContext('2d'),target=canvas.getContext('2d');
 canvas.width=WIDTH*8;canvas.height=HEIGHT*5;target.imageSmoothingEnabled=false;
  // One image is reused for the life of the display, so presenting a frame allocates
 // nothing. Building it fresh each time cost 123 KB of garbage per frame.
 const image=source.createImageData(WIDTH,HEIGHT);
 return {present(frame){frame.blit(image.data);source.putImageData(image,0,0);target.drawImage(buffer,0,0,canvas.width,canvas.height);}};
}
