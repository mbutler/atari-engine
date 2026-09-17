// A visual grammar, not a cycle-accurate TIA emulator.
export const WIDTH=160, HEIGHT=192;
// Deliberately small NTSC-style RGB interpretation. Analog colors varied with
// console, television and emulator; replace this map to calibrate the display.
export const PALETTE=Object.freeze({
  0x00:'#000000',0x02:'#404040',0x06:'#909090',0x0a:'#c8c8c8',0x0e:'#ececec',
  0x16:'#a0a034',0x18:'#b8b840',0x1c:'#e8e85c',0x28:'#bc8c4c',0x36:'#b46a3c',
  0x46:'#b03c3c',0x4c:'#eca0a0',0x56:'#a03c88',0x66:'#783ca4',0x76:'#503c98',
  0x86:'#3840b0',0x8c:'#a4a8fc',0x96:'#285ca0',0xa6:'#287c8c',0xac:'#90dcec',
  0xb6:'#308c5c',0xc6:'#408440',0xcc:'#a4dca4',0xd6:'#688034',0xe6:'#7c7020',
});
function integer(value,name){if(!Number.isInteger(value))throw new TypeError(`${name} must be an integer`);return value;}
function scale(value,name){integer(value,name);if(value<1)throw new RangeError(`${name} must be positive`);return value;}
const DIGITS=[['111','101','101','101','111'],['010','110','010','010','111'],['111','001','111','100','111'],['111','001','111','001','111'],['101','101','111','001','001'],['111','100','111','001','111'],['111','100','111','101','111'],['111','001','001','001','001'],['111','101','111','101','111'],['111','101','111','001','111']];
export class VCSFrame {
 constructor(palette=PALETTE){this.palette=palette;this.pixels=new Uint8Array(WIDTH*HEIGHT);this.commands=[];}
 color(code){if(!Object.hasOwn(this.palette,code))throw new RangeError(`Unconfigured color $${Number(code).toString(16)}`);return code;}
 clear(color=0){this.pixels.fill(this.color(color));this.commands=[];return this;}
 // Rectangles are internal raster operations; authors normally use the typed primitives.
 rect(x,y,w,h,color){[x,y,w,h].forEach(v=>integer(v,'coordinate'));this.color(color);for(let yy=Math.max(0,y);yy<Math.min(HEIGHT,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(WIDTH,x+w);xx++)this.pixels[yy*WIDTH+xx]=color;return this;}
 background(y,height,color){this.rect(0,y,WIDTH,height,color);this.commands.push({kind:'background',y,height,color});return this;}
 // Each playfield bit is four color clocks wide. Half fields are 20 bits.
 playfield(bits,{y=0,height=8,color=0x0e,mode='mirror'}={}){
  if(!['mirror','repeat','asymmetric'].includes(mode))throw new RangeError('Unknown playfield mode');
  if(typeof bits!=='string'||!/^[01]+$/.test(bits)||bits.length!==(mode==='asymmetric'?40:20))throw new RangeError('Playfield requires 20 bits, or 40 in asymmetric mode');
  const row=mode==='asymmetric'?bits:bits+(mode==='mirror'?[...bits].reverse().join(''):bits);
  [...row].forEach((bit,i)=>{if(bit==='1')this.rect(i*4,y,4,height,color);});
  this.commands.push({kind:'playfield',bits,y,height,color,mode});return this;
 }
 sprite(rows,{x=0,y=0,color=0x0e,stretch=1,lineHeight=2,reflect=false,colors=null}={}){
  if(![1,2,4].includes(stretch))throw new RangeError('Sprite stretch must be 1, 2 or 4');scale(lineHeight,'lineHeight');
  if(!Array.isArray(rows)||!rows.length||rows.some(r=>!Number.isInteger(r)||r<0||r>255))throw new RangeError('Sprite rows must be 8-bit integers');
  if(colors&&colors.length!==rows.length)throw new RangeError('One color per sprite row required');
  rows.forEach((row,iy)=>{const ink=colors?colors[iy]:color;this.color(ink);for(let bit=0;bit<8;bit++)if(row&(1<<(7-bit)))this.rect(x+(reflect?7-bit:bit)*stretch,y+iy*lineHeight,stretch,lineHeight,ink);});
  this.commands.push({kind:'sprite',x,y,width:8*stretch,height:rows.length*lineHeight});return this;
 }
 missile(x,y,{width=1,height=2,color=0x0e}={}){if(![1,2,4,8].includes(width))throw new RangeError('Missile width must be 1, 2, 4 or 8');this.rect(x,y,width,height,color);this.commands.push({kind:'missile',x,y,width,height});return this;}
 number(value,{x=0,y=0,color=0x0e,digits=2,scaleX=2,scaleY=3,gap=2}={}){
  integer(value,'value');if(value<0)throw new RangeError('Score cannot be negative');scale(scaleX,'scaleX');scale(scaleY,'scaleY');scale(digits,'digits');
  const str=String(value).padStart(digits,'0');[...str].forEach((digit,i)=>DIGITS[Number(digit)].forEach((row,iy)=>[...row].forEach((bit,ix)=>{if(bit==='1')this.rect(x+i*(3*scaleX+gap)+ix*scaleX,y+iy*scaleY,scaleX,scaleY,color);})));return this;
 }
 rgba(scaleX=8,scaleY=5){scale(scaleX,'scaleX');scale(scaleY,'scaleY');const width=WIDTH*scaleX,height=HEIGHT*scaleY,data=new Uint8ClampedArray(width*height*4),lookup={};for(const [key,hex] of Object.entries(this.palette)){lookup[key]=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255];}for(let y=0;y<height;y++)for(let x=0;x<width;x++){const color=lookup[this.pixels[Math.floor(y/scaleY)*WIDTH+Math.floor(x/scaleX)]];data.set(color,(y*width+x)*4);}return {width,height,data};}
 present(canvas,{raw=false}={}){const {width,height,data}=this.rgba(raw?1:8,raw?1:5);canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.putImageData(new ImageData(data,width,height),0,0);return this;}
 stats(){return {colors:new Set(this.pixels).size,sprites:this.commands.filter(c=>c.kind==='sprite').length,playfieldBands:this.commands.filter(c=>c.kind==='playfield').length};}
}
