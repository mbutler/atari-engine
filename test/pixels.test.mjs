import test from 'node:test';
import assert from 'node:assert/strict';
import {pixels,pixelText,VCSFrame} from '../src/index.mjs';
test('pixel art becomes eight-bit sprite rows',()=>{
 assert.deepEqual(pixels(`
  ###.....
  ....####
  ........
  ########
 `),[0xe0,0x0f,0x00,0xff]);
});
test('indentation and blank lines around the art are ignored',()=>{
 assert.deepEqual(pixels('##......\n..##....'),pixels(`

      ##......
      ..##....

 `));
});
test('art round-trips through text without loss',()=>{
 const rows=[0x24,0x7e,0xdb,0xff,0xbd,0xa5,0x24,0x42];
 assert.deepEqual(pixels(pixelText(rows)),rows);
 assert.equal(pixelText([0xa5]),'#.#..#.#');
 // Either character can be chosen, and the pair stays reversible.
 assert.equal(pixelText([0xa5],{on:'X',off:'-'}),'X-X--X-X');
 assert.deepEqual(pixels('X-X--X-X',{off:'-'}),[0xa5]);
});
test('malformed art names the row and shows the line',()=>{
 assert.throws(()=>pixels('###'),/Row 1 is 3 wide/);
 assert.throws(()=>pixels('########\n##.##'),/Row 2 is 5 wide/);
 // A space is ambiguous against the indentation that gets stripped, so it is refused.
 assert.throws(()=>pixels('## ##...'),/contains a space/);
 assert.throws(()=>pixels('\n\n   \n'),/at least one row/);
 assert.throws(()=>pixels(42),/must be a string/);
 assert.throws(()=>pixels('########',{off:'..'}),/single character/);
 assert.throws(()=>pixelText([256]),/8-bit integers/);
});
test('the playfield takes the same notation as the sprite art',()=>{
 const drawn=new VCSFrame().clear().playfield('##..................',{height:4,color:0x1c});
 const bits=new VCSFrame().clear().playfield('11000000000000000000',{height:4,color:0x1c});
 assert.deepEqual([...drawn.pixels],[...bits.pixels]);
 assert.equal(drawn.commands.at(-1).bits,'11000000000000000000','commands record the canonical form');
 assert.throws(()=>new VCSFrame().playfield('##.#'),/20 cells/);
 assert.throws(()=>new VCSFrame().playfield('0#01................'),/20 cells/,'notations cannot be mixed');
 const wide=new VCSFrame().clear().playfield('#'.padEnd(40,'.'),{mode:'asymmetric',height:1});
 assert.equal(wide.pixels[0],0x0e);assert.equal(wide.pixels[159],0);
});
