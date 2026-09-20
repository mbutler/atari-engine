import {createInput,createGamepad,combineInputs} from '../src/index.mjs';
// Keep the two ports separate: combineInputs merges devices for ONE player.
export function createDuelInputs({target=document,pads=null,onCommand=()=>{}}={}){
 const left=combineInputs(createInput({target,keys:{KeyW:'up',KeyS:'down',Space:'action'},onCommand}),createGamepad({index:0,pads}));
 const right=combineInputs(createInput({target,keys:{ArrowUp:'up',ArrowDown:'down',Enter:'action'}}),createGamepad({index:1,pads}));
 return {read:()=>({left:left.read(),right:right.read()}),
  clear(){left.clear();right.clear();},destroy(){left.destroy();right.destroy();}};
}
