// Sprite artwork as something a person can read and review. Hand-written hex hides
// mistakes: nobody spots a changed antenna in `0x24` during review, but everyone
// spots it in the picture. The art is still the cartridge's; this is only the format.
const single=(value,name)=>{if(typeof value!=='string'||[...value].length!==1)throw new TypeError(`${name} must be a single character`);return value;};
// Eight columns wide, one line per row, '.' for an empty pixel and any other visible
// character for a set one. Indentation and blank lines around the art are ignored, so
// a deliberately empty row is written out in full rather than left blank.
export function pixels(art,{off='.'}={}){
 if(typeof art!=='string')throw new TypeError('Pixel art must be a string');
 single(off,'off');
 const lines=art.split('\n').map(line=>line.trim()).filter(line=>line.length);
 if(!lines.length)throw new RangeError('Pixel art needs at least one row');
 return lines.map((line,index)=>{
  if(/\s/.test(line))throw new RangeError(`Row ${index+1} contains a space; use '${off}' for an empty pixel: "${line}"`);
  if([...line].length!==8)throw new RangeError(`Row ${index+1} is ${[...line].length} wide, but a player is 8 pixels: "${line}"`);
  let value=0;
  for(let bit=0;bit<8;bit++)if(line[bit]!==off)value|=1<<(7-bit);
  return value;
 });
}
// The inverse, for reading a sprite back in a test failure or a console.
export function pixelText(rows,{on='#',off='.'}={}){
 single(on,'on');single(off,'off');
 if(!Array.isArray(rows)||!rows.length||rows.some(r=>!Number.isInteger(r)||r<0||r>255))throw new RangeError('Sprite rows must be 8-bit integers');
 return rows.map(row=>{let line='';for(let bit=0;bit<8;bit++)line+=row&(1<<(7-bit))?on:off;return line;}).join('\n');
}
