// A visual grammar, not a cycle-accurate TIA emulator.
export const WIDTH=160, HEIGHT=192;
// The full 16 hue by 8 luminance NTSC grid. Hue 0 is the grey ladder; hues 1-15
// step the colorburst by roughly 26.2 degrees, so $Fx lands just past $1x the way
// real hardware does. Values were fitted to the 25 hand-picked colors this engine
// shipped with in 0.1, which all reproduce to within one step per channel; the rest
// of the grid is interpolated from them. Analog colors varied with console,
// television and emulator: replace this map to calibrate the display.
export const PALETTE=Object.freeze({
 0x00:'#000000',0x02:'#404040',0x04:'#6c6c6c',0x06:'#909090',0x08:'#b0b0b0',0x0a:'#c8c8c8',0x0c:'#dcdcdc',0x0e:'#ececec',
 0x10:'#58580b',0x12:'#707018',0x14:'#888826',0x16:'#a0a033',0x18:'#b8b841',0x1a:'#d0d04e',0x1c:'#e8e85c',0x1e:'#ffff69',
 0x20:'#4d1600',0x22:'#683400',0x24:'#84510c',0x26:'#a06f2c',0x28:'#bc8c4c',0x2a:'#d8aa6c',0x2c:'#f4c78b',0x2e:'#ffe5ab',
 0x30:'#611100',0x32:'#7d2f00',0x34:'#984c1d',0x36:'#b46a3c',0x38:'#d0885b',0x3a:'#eba67a',0x3c:'#ffc399',0x3e:'#ffe1b8',
 0x40:'#6a0000',0x42:'#870000',0x44:'#9c1b1b',0x46:'#b03c3c',0x48:'#c45d5d',0x4a:'#d87f7f',0x4c:'#eca0a0',0x4e:'#ffc1c1',
 0x50:'#4e0034',0x52:'#690050',0x54:'#851e6c',0x56:'#a03c88',0x58:'#bb5aa4',0x5a:'#d779c0',0x5c:'#f297dc',0x5e:'#ffb6f8',
 0x60:'#240055',0x62:'#40006f',0x64:'#5c1e8a',0x66:'#783ca4',0x68:'#945abe',0x6a:'#b079d9',0x6c:'#cc97f3',0x6e:'#e8b6ff',
 0x70:'#00004b',0x72:'#160065',0x74:'#331e7e',0x76:'#503c98',0x78:'#6d5ab2',0x7a:'#8a78cc',0x7c:'#a796e5',0x7e:'#c4b4ff',
 0x80:'#000065',0x82:'#00007e',0x84:'#151d98',0x86:'#393fb1',0x88:'#5c62ca',0x8a:'#8085e3',0x8c:'#a3a8fc',0x8e:'#c7cbff',
 0x90:'#000550',0x92:'#00226b',0x94:'#093f85',0x96:'#285ca0',0x98:'#4779bb',0x9a:'#6596d6',0x9c:'#84b3f1',0x9e:'#a3d0ff',
 0xa0:'#001b2e',0xa2:'#003c4d',0xa4:'#065c6d',0xa6:'#287c8d',0xa8:'#4b9cac',0xaa:'#6dbccc',0xac:'#90dcec',0xae:'#b2fcff',
 0xb0:'#003703',0xb2:'#005420',0xb4:'#11703e',0xb6:'#308c5c',0xb8:'#4fa87a',0xba:'#6ec498',0xbc:'#8ee0b5',0xbe:'#adfdd3',
 0xc0:'#002c00',0xc2:'#004900',0xc4:'#1f671f',0xc6:'#408440',0xc8:'#61a161',0xca:'#83bf83',0xcc:'#a4dca4',0xce:'#c5f9c5',
 0xd0:'#0f2b00',0xd2:'#2d4700',0xd4:'#4a6413',0xd6:'#688034',0xd8:'#869c55',0xda:'#a3b975',0xdc:'#c1d596',0xde:'#dff1b7',
 0xe0:'#271900',0xe2:'#433600',0xe4:'#605300',0xe6:'#7c7020',0xe8:'#998d40',0xea:'#b5aa61',0xec:'#d1c781',0xee:'#eee4a2',
 0xf0:'#3e0400',0xf2:'#5a2200',0xf4:'#763f03',0xf6:'#915d22',0xf8:'#ad7a42',0xfa:'#c99861',0xfc:'#e5b681',0xfe:'#ffd3a1',
});
// Two players, two missiles and one ball is all the TIA can place on a scanline.
// Reusing an object further down the screen is free, which is how real games draw
// more than two things. Raise or replace this to build beyond the hardware.
// What the console's colour switch does to a colour: hue 0 at the same luminance.
// The palette is laid out as (hue << 4) | (luma << 1), so the hue simply drops away.
export const greyscale=code=>code&0x0e;
export const TIA_BUDGET=Object.freeze({sprites:2,missiles:3});
export const UNLIMITED=Object.freeze({sprites:Infinity,missiles:Infinity});
function integer(value,name){if(!Number.isInteger(value))throw new TypeError(`${name} must be an integer`);return value;}
function scale(value,name){integer(value,name);if(value<1)throw new RangeError(`${name} must be positive`);return value;}
const BUDGETED={sprite:'sprites',missile:'missiles'};
// Counts objects already occupying each scanline the new one covers. Runs before
// any pixels are written so a rejected draw leaves the frame untouched.
function charge(frame,kind,y,height){
 const budget=frame.budget;if(!budget)return;
 const limit=budget[BUDGETED[kind]];if(!Number.isFinite(limit))return;
 integer(y,'y');
 for(let line=Math.max(0,y),end=Math.min(HEIGHT,y+height);line<end;line++){
  let count=1;
  for(const c of frame.commands)if(c.kind===kind&&line>=c.y&&line<c.y+c.height)count++;
  if(count>limit)throw new RangeError(`Scanline ${line} would need ${count} ${BUDGETED[kind]}, but the budget allows ${limit}. Move the object to another scanline, or raise frame.budget.`);
 }
}
const DIGITS=[['111','101','101','101','111'],['010','110','010','010','111'],['111','001','111','100','111'],['111','001','111','001','111'],['101','101','111','001','001'],['111','100','111','001','111'],['111','100','111','101','111'],['111','001','001','001','001'],['111','101','111','101','111'],['111','101','111','001','111']];
export class VCSFrame {
 constructor(palette=PALETTE,{budget=TIA_BUDGET}={}){this.palette=palette;this.budget=budget;this.pixels=new Uint8Array(WIDTH*HEIGHT);this.commands=[];this.occupancy=null;this.slots=[];this.touches=new Set();this.drawing=null;}
 // Collision is latched while drawing and read afterwards, the way a cartridge reads
 // the TIA's collision registers during vertical blank. Overlap is pixel-exact rather
 // than by bounding box, which is what makes 2600 games feel tight around the concave
 // parts of a sprite. Tag an object with `id` to track it; untagged objects cost
 // nothing. Draws sharing an id are one object, exactly as a reused register behaves,
 // so a row of repeated enemies reports one hit and the game works out which from
 // position. The background is not an object and never collides.
 track(id){
  if(typeof id!=='string'||!id)throw new TypeError('A collision id must be a non-empty string');
  let bit=this.slots.indexOf(id);
  if(bit<0){
   if(this.slots.length>=32)throw new RangeError('A frame tracks at most 32 collision ids');
   if(!this.occupancy)this.occupancy=new Uint32Array(WIDTH*HEIGHT);
   this.slots.push(id);bit=this.slots.length-1;
  }
  return bit;
 }
 // Every pair between what already owns a pixel and what is arriving on it.
 meet(mask,bit){for(let other=0;mask;other++,mask>>>=1)if((mask&1)&&other!==bit)this.touches.add(other<bit?other*32+bit:bit*32+other);}
 paint(id,draw){const previous=this.drawing;if(id!==null&&id!==undefined)this.drawing=this.track(id);try{draw();}finally{this.drawing=previous;}}
 collisions(){return [...this.touches].map(key=>[this.slots[Math.floor(key/32)],this.slots[key%32]].sort()).sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1]));}
 // hit(a, b) asks about one pair; hit(a) lists everything a touched this frame.
 hit(a,b){
  if(b===undefined)return this.collisions().filter(pair=>pair.includes(a)).map(pair=>pair[0]===a?pair[1]:pair[0]);
  const x=this.slots.indexOf(a),y=this.slots.indexOf(b);
  return x>=0&&y>=0&&x!==y&&this.touches.has(x<y?x*32+y:y*32+x);
 }
 color(code){if(!Object.hasOwn(this.palette,code))throw new RangeError(`Unconfigured color $${Number(code).toString(16)}`);return code;}
 clear(color=0){this.pixels.fill(this.color(color));this.commands=[];this.slots.length=0;this.touches.clear();if(this.occupancy)this.occupancy.fill(0);this.drawing=null;return this;}
 // Rectangles are internal raster operations; authors normally use the typed primitives.
 rect(x,y,w,h,color){
  [x,y,w,h].forEach(v=>integer(v,'coordinate'));this.color(color);
  const bit=this.drawing,occupancy=this.occupancy;
  for(let yy=Math.max(0,y);yy<Math.min(HEIGHT,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(WIDTH,x+w);xx++){
   const at=yy*WIDTH+xx;this.pixels[at]=color;
   if(bit!==null){const had=occupancy[at];if(had)this.meet(had,bit);occupancy[at]=had|(1<<bit);}
  }
  return this;
 }
 background(y,height,color){this.rect(0,y,WIDTH,height,color);this.commands.push({kind:'background',y,height,color});return this;}
 // One background color per scanline, the way a game rewrites COLUBK down the
 // frame. `colorFor(line, offset)` returns a color, or null to leave the line be.
 scanlines(y,height,colorFor){
  integer(y,'y');scale(height,'height');
  if(typeof colorFor!=='function')throw new TypeError('scanlines requires a color function');
  for(let i=0;i<height;i++){
   const line=y+i;if(line<0||line>=HEIGHT)continue;
   const color=colorFor(line,i);if(color===null||color===undefined)continue;
   this.rect(0,line,WIDTH,1,color);
  }
  this.commands.push({kind:'scanlines',y,height});return this;
 }
 // Each playfield bit is four color clocks wide. Half fields are 20 bits.
 playfield(bits,{y=0,height=8,color=0x0e,mode='mirror',id=null}={}){
  if(!['mirror','repeat','asymmetric'].includes(mode))throw new RangeError('Unknown playfield mode');
  if(typeof bits!=='string'||!/^[01]+$/.test(bits)||bits.length!==(mode==='asymmetric'?40:20))throw new RangeError('Playfield requires 20 bits, or 40 in asymmetric mode');
  const row=mode==='asymmetric'?bits:bits+(mode==='mirror'?[...bits].reverse().join(''):bits);
  this.paint(id,()=>[...row].forEach((bit,i)=>{if(bit==='1')this.rect(i*4,y,4,height,color);}));
  this.commands.push({kind:'playfield',bits,y,height,color,mode});return this;
 }
 // NUSIZ: a player can be drawn as two or three copies at a fixed spacing, or as one
 // stretched object, but never both. Copies are one register, so they share a bitmap,
 // a color and a reflection, and they move together. Those restrictions are why a row
 // of 2600 objects reads as a grid of identical things flapping in lockstep.
 sprite(rows,{x=0,y=0,color=0x0e,stretch=1,lineHeight=2,reflect=false,colors=null,copies=1,spacing=32,id=null}={}){
  if(![1,2,4].includes(stretch))throw new RangeError('Sprite stretch must be 1, 2 or 4');scale(lineHeight,'lineHeight');
  if(!Array.isArray(rows)||!rows.length||rows.some(r=>!Number.isInteger(r)||r<0||r>255))throw new RangeError('Sprite rows must be 8-bit integers');
  if(colors&&colors.length!==rows.length)throw new RangeError('One color per sprite row required');
  if(![1,2,3].includes(copies))throw new RangeError('Sprite copies must be 1, 2 or 3');
  if(copies>1){
   if(stretch!==1)throw new RangeError('A player is either repeated or stretched, never both: use copies with stretch 1');
   if(![16,32,64].includes(spacing))throw new RangeError('Copy spacing must be 16, 32 or 64 color clocks');
   if(copies===3&&spacing===64)throw new RangeError('Three copies exist only at 16 or 32 spacing');
  }
  const height=rows.length*lineHeight;
  charge(this,'sprite',y,height); // one register however many copies it paints
  this.paint(id,()=>{for(let copy=0;copy<copies;copy++){const left=x+copy*spacing;
   rows.forEach((row,iy)=>{const ink=colors?colors[iy]:color;this.color(ink);for(let bit=0;bit<8;bit++)if(row&(1<<(7-bit)))this.rect(left+(reflect?7-bit:bit)*stretch,y+iy*lineHeight,stretch,lineHeight,ink);});}});
  this.commands.push({kind:'sprite',x,y,width:(copies-1)*spacing+8*stretch,height,copies,spacing:copies>1?spacing:0});return this;
 }
 missile(x,y,{width=1,height=2,color=0x0e,id=null}={}){if(![1,2,4,8].includes(width))throw new RangeError('Missile width must be 1, 2, 4 or 8');charge(this,'missile',y,height);this.paint(id,()=>this.rect(x,y,width,height,color));this.commands.push({kind:'missile',x,y,width,height});return this;}
 number(value,{x=0,y=0,color=0x0e,digits=2,scaleX=2,scaleY=3,gap=2}={}){
  integer(value,'value');if(value<0)throw new RangeError('Score cannot be negative');scale(scaleX,'scaleX');scale(scaleY,'scaleY');scale(digits,'digits');
  const str=String(value).padStart(digits,'0').slice(-digits);[...str].forEach((digit,i)=>DIGITS[Number(digit)].forEach((row,iy)=>[...row].forEach((bit,ix)=>{if(bit==='1')this.rect(x+i*(3*scaleX+gap)+ix*scaleX,y+iy*scaleY,scaleX,scaleY,color);})));return this;
 }
 // Palette lookups are cached per palette object: this runs on every rendered frame.
 lut(){
  if(this.cachedLut&&this.cachedFor===this.palette)return this.cachedLut;
  const lut=new Uint8ClampedArray(256*4);
  for(const [key,hex] of Object.entries(this.palette)){const i=Number(key)*4;lut[i]=parseInt(hex.slice(1,3),16);lut[i+1]=parseInt(hex.slice(3,5),16);lut[i+2]=parseInt(hex.slice(5,7),16);lut[i+3]=255;}
  this.cachedFor=this.palette;return this.cachedLut=lut;
 }
 // Writes the frame 1:1 into a buffer that already exists. The animation path calls
 // this every frame, so presenting a frame allocates nothing at all.
 blit(data){
  if(data.length!==WIDTH*HEIGHT*4)throw new RangeError(`Blit target must hold ${WIDTH*HEIGHT*4} RGBA bytes`);
  const lut=this.lut(),pixels=this.pixels;
  for(let i=0,o=0;i<pixels.length;i++,o+=4){const c=pixels[i]*4;data[o]=lut[c];data[o+1]=lut[c+1];data[o+2]=lut[c+2];data[o+3]=255;}
  return this;
 }
 rgba(scaleX=8,scaleY=5){scale(scaleX,'scaleX');scale(scaleY,'scaleY');const width=WIDTH*scaleX,height=HEIGHT*scaleY,data=new Uint8ClampedArray(width*height*4);
  if(scaleX===1&&scaleY===1){this.blit(data);return {width,height,data};}
  const lut=this.lut();for(let y=0;y<height;y++){const row=Math.floor(y/scaleY)*WIDTH;for(let x=0;x<width;x++){const c=this.pixels[row+Math.floor(x/scaleX)]*4,o=(y*width+x)*4;data[o]=lut[c];data[o+1]=lut[c+1];data[o+2]=lut[c+2];data[o+3]=255;}}return {width,height,data};}
 present(canvas,{raw=false}={}){const {width,height,data}=this.rgba(raw?1:8,raw?1:5);canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.putImageData(new ImageData(data,width,height),0,0);return this;}
 stats(){return {colors:new Set(this.pixels).size,sprites:this.commands.filter(c=>c.kind==='sprite').length,playfieldBands:this.commands.filter(c=>c.kind==='playfield').length};}
}
