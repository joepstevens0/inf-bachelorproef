

const lock = 1;
const unlocked = 0;

export default class Mutex{

    static lock(array: ArrayBufferLike){
        while(Atomics.compareExchange(new Uint8Array(array), array.byteLength-1,unlocked, lock) == lock){
            // do nothing
        }
    }
    static unlock(array: ArrayBufferLike){
        Atomics.store(new Uint8Array(array), array.byteLength-1, unlocked);
    }
}