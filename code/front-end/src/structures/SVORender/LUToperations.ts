import { HASHVALUE } from "../../constants";



const LUTSize = function(lut: Uint32Array): number{
    return Math.floor(lut.length/3)
}
const LUTHash = function(lut: Uint32Array,pageNumber: number): number{
    return pageNumber % HASHVALUE;
}

let searchPointer = HASHVALUE;
export const findEmptySpace = function(lut: Uint32Array): number{
    for (let i = 0; i < LUTSize(lut) - HASHVALUE;++i){
        if (lut[3*searchPointer] == 0){
            return searchPointer;
        }
        searchPointer += 1;
        if (searchPointer >= LUTSize(lut)){
            searchPointer = HASHVALUE;
        }
    }
    return 0;
}

export const LUTFind = function(lut: Uint32Array, pageNumber: number): number{
    
    let pos = LUTHash(lut, pageNumber);

    do{
        if (lut[3*pos] == pageNumber){
            return lut[3*pos + 1];
        } else if (lut[3*pos] == 0){
            return 0;
        }
        pos = lut[3*pos + 2];
    } while (pos != 0);

    return 0;
}

/**
 * Updates the LUT for a page
 * @param pageNumber: page updating
 * @param cachePointer: new cache pointer for the page
 * @post The LUT value for page <pageNumber> is <cachePointer>
 */
export const LUTAdd = function(lut: Uint32Array, pageNumber: number, cachePointer: number){
    const hash = LUTHash(lut, pageNumber);

    if (pageNumber == 0 || (lut[3*hash] == 0 && hash != 0)){
        // head is empty, fill with cachePointer
        lut[3*hash] = pageNumber;
        lut[3*hash + 1] = cachePointer;
        lut[3*hash + 2] = 0;
        return;
    }
    
    // find empty space in lut
    const s = findEmptySpace(lut);
    if (s == 0){
        console.error("Error no space in the LUT");
        return;
    }

    // fill empty space with lut value
    lut[3*s] = pageNumber;
    lut[3*s + 1] = cachePointer;
    lut[3*s + 2] = 0;

    // find last cachepointer in linked list
    let pos = hash;
    while (lut[3*pos + 2] != 0){
        pos = lut[3*pos + 2];
    }
    lut[3*pos + 2] = s; // update linked list
}

const removeElement = function(lut: Uint32Array, pos: number, parentPos: number = pos){
    if (parentPos != pos){
        // cachpointer is not the head
        lut[3*pos] = 0;
        lut[3*parentPos + 2] = lut[3*pos + 2];
    } else{
        // cachepointer is located at the head
        const next = lut[3*pos + 2];
        if (next == 0){
            // no next node, remove head
            lut[3*pos] = 0;
        }else{
            // place next node as new head
            lut[3*pos] = lut[3*next];
            lut[3*pos + 1] = lut[3*next + 1];
            lut[3*pos + 2] = lut[3*next + 2];
            lut[3*next] = 0;    // remove value in next
        }
    }
}
export const LUTRemove = function(lut: Uint32Array, pageNumber: number){

    let pos = LUTHash(lut, pageNumber);
    let lastPos = pos;

    do{
        if (lut[3*pos] == pageNumber){
            removeElement(lut, pos, lastPos);
            return;
        }

        lastPos = pos;
        pos = lut[3*pos + 2];
    } while (pos != 0);

    return;
}