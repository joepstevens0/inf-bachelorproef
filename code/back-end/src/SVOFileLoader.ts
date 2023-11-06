import fs from "fs";

const CHILDMASK_BITS = 8;

export default class SVOFileLoader{
    private _file;
    private _optimized: boolean;
    private _childPointerSizeUpdates : number[] = [];
    private _colorSize: number;
    private _colorList: number[] = [];

    constructor(path: string, optimizedSVO: boolean){
        this._file = fs.readFileSync(path, {encoding: 'binary'});
        this._optimized = optimizedSVO;

        if (this._optimized){
            // SVO is optimized for childpointer size and colors, retreive the values
            let p = 0;
            p += this.retreiveSizeUpdates(p);
            this.retreiveColors(p);
        }
    }

    public totalPages(pageSize: number): number{
        if (!this._optimized){
            return Math.ceil((this.fileSize()/8)/pageSize);
        }

        let d = 8*this.fileSize() - this.nodeStartBit();
        let currentNodeSize = CHILDMASK_BITS + this._colorSize + 1;
        let lastPos = 0;
        for (let i = 0; i < this._childPointerSizeUpdates.length;++i){
            d -= currentNodeSize * (this._childPointerSizeUpdates[i] - lastPos);
            lastPos = this._childPointerSizeUpdates[i];
            currentNodeSize += 1;
        }

        return (this._childPointerSizeUpdates[this._childPointerSizeUpdates.length-1]
         + Math.floor(d / currentNodeSize))/pageSize;
    }

    /**
     * Retreive the positions where node sizes update in the file
     * @param startByte the size updates list
     * @returns total size of the size update list in bytes
     * @post this._childPointerSizeUpdates contains the positions where nodes change in size
     */
    private retreiveSizeUpdates(startByte: number): number{
        while (startByte < this._file.length/4){
            const childPUpdateIndex = this.getUint32(startByte);
            if (childPUpdateIndex === 0){
                break;
            }
            else{
                this._childPointerSizeUpdates.push(childPUpdateIndex);
            }
            startByte += 4;
        }
        startByte += 4;

        console.log("ChildPointer size updates:", this._childPointerSizeUpdates);
        console.log("ChildPointer max bits:", this._childPointerSizeUpdates.length + 1,  " bits");

        return startByte;
    }

    /**
     * Retreive the color map for the SVO file
     * @param startByte: byte where the map starts
     * @post this._colorList contains all colors linked to their id
     */
    private retreiveColors(startByte : number){
        this._colorSize = this.getUint32(startByte);
        startByte += 4;
        const totalColors = this.getUint32(startByte);
        startByte += 4;
        for (let i = 0; i < totalColors;++i){
            const color = this.getUint32(startByte + 4*i);
            this._colorList.push(color);
        }

        console.log("Color size:", this._colorSize, " bits");
        console.log("Total colors:", totalColors);
    }

    /**
     * Get a page from the file
     * @param pagePointer position of the page
     * @param pageSize total nodes in one page
     * @returns the page with size <pageSize> on position <pagePointer>
     */
    public loadPage(pagePointer: number, pageSize: number): BigUint64Array{
        const result = new BigUint64Array(pageSize);

        const nodeP = pagePointer*pageSize;
        for (let i = 0; i < pageSize;++i){
            try{
                result[i] = this.loadNode(nodeP + i);
            } catch(e){
                result[i] = BigInt(0);
            }
        }

        return result;
    }

    /**
     * Get a node from the SVO file
     * @param nodePointer pointer to the node
     * @returns bigint containing the node data for the node with number <nodePointer>
     */
    public loadNode(nodePointer: number): bigint{
        const nodeInfo = this.getNode(nodePointer);
        return nodeInfo;

    }

    /**
     * @returns the total size of the SVO file
     */
    public fileSize(): number{
        return this._file.length;
    }

    /**
     * @returns the bit number where the nodes are found in the SVO file
     */
    private nodeStartBit(): number{
        const childInfoL = 32*this._childPointerSizeUpdates.length + 32;
        const colorInfoL = 32 + 32 + 32*this._colorList.length;
        return childInfoL + colorInfoL;
    }
    /**
     * Get the bit pointer in the file for a node
     * @param nodePointer: number of the node
     * @returns the bit pointer for the node with number <nodePointer>
     */
    private getNodeBitPointer(nodePointer: number): {bitP: number;childPBits: number; size: number}{
        // find bitpointer and size
        let childPBits = 1;
        let bitPointer = this.nodeStartBit();
        let sizeStart = 0;
        let currentNodeSize = CHILDMASK_BITS + childPBits + this._colorSize;
        let nodesSkipped = 0;

        for (let i = 0; i  < this._childPointerSizeUpdates.length;++i){
            if (nodePointer >= this._childPointerSizeUpdates[i]){
                // skip nodes of other childpointer size
                bitPointer += currentNodeSize*(this._childPointerSizeUpdates[i] - sizeStart);
                nodesSkipped += this._childPointerSizeUpdates[i] - sizeStart;

                // go to next node range
                childPBits += 1;
                sizeStart = this._childPointerSizeUpdates[i];
                currentNodeSize = CHILDMASK_BITS + childPBits + this._colorSize;

            } else{
                break;
            }
        }
        bitPointer += (nodePointer - nodesSkipped)*currentNodeSize;
        return {bitP: bitPointer, childPBits, size: currentNodeSize};
    }

    /**
     * Get the node data of a node by number
     * @param nodePointer: number of the node
     * @returns The node data for the node with number <nodePointer>
     */
    private getNode(nodePointer: number): bigint{

        if (!this._optimized){
            // every node is 64 bits, read it directly
            return this.getBigUint64(nodePointer*8);
        }

        const bitPointer = this.getNodeBitPointer(nodePointer);
        const nodeInfo = this.getData(bitPointer.bitP, bitPointer.size);

        const childMask = nodeInfo >> BigInt(bitPointer.size-CHILDMASK_BITS);
        const childPointer = (nodeInfo >> BigInt(this._colorSize)) & BigInt(2**(bitPointer.childPBits) - 1);
        const color = nodeInfo & BigInt(2**(this._colorSize) - 1);
        const node = (childMask  << BigInt(56)) | (childPointer << BigInt(32)) | BigInt(this._colorList[Number(color)]);


        return node;
    }
    /**
     * Get bits on a bit position in the SVO file
     * @param bitPointer: startbit of the bigint
     * @param dataSize: total bits retreiving
     * @pre dataSize <= 64
     * @returns <dataSize> bits from position <bitPointer> in the SVOFile
     */
    private getData(bitPointer: number, dataSize: number): bigint{

        let result = BigInt(0);

        const beginByte = (bitPointer - (bitPointer % 8))/8;
        const endByte = Math.ceil((bitPointer + dataSize)/8);

        let byte = beginByte;

        while (byte < endByte){
            result = (result << BigInt(8)) | BigInt(this._file.charCodeAt(byte));
            byte += 1;
        }

        // remove extra bits in the back
        const backExtraBits = 8*endByte - ((bitPointer+dataSize));
        result = (result >> BigInt(backExtraBits));

        // remove extra bits in front
        result = result & ((BigInt(1) << BigInt(dataSize)) - BigInt(1));

        return result;
    }

    /**
     * Get a 32 bit uint from the file on a byte position
     * @param bytePos: position retreiving uint from
     * @returns 32 bit unsigned int from the file on position <bytePos>
     */
    private getUint32(bytePos: number): number{
        const result: Uint32Array = new Uint32Array(1);
        result[0] = result[0] | this._file.charCodeAt(bytePos);
        result[0] = result[0] << 8;

        result[0] = result[0] | this._file.charCodeAt(bytePos+1);
        result[0] = result[0] << 8;

        result[0] = result[0] | this._file.charCodeAt(bytePos+2);
        result[0] = result[0] << 8;

        result[0] = result[0] | this._file.charCodeAt(bytePos+3);

        return result[0];
    }

    private getBigUint64(bytePos: number){
        let r = BigInt(0);
        r |= BigInt(this._file.charCodeAt(bytePos));
        r  = r << BigInt(8);
        r |= BigInt(this._file.charCodeAt(bytePos + 1));
        r  = r << BigInt(8);
        r |= BigInt(this._file.charCodeAt(bytePos + 2));
        r  = r << BigInt(8);
        r |= BigInt(this._file.charCodeAt(bytePos + 3));
        r  = r << BigInt(8);
        r |= BigInt(this._file.charCodeAt(bytePos + 4));
        r  = r << BigInt(8);
        r |= BigInt(this._file.charCodeAt(bytePos + 5));
        r  = r << BigInt(8);
        r |= BigInt(this._file.charCodeAt(bytePos + 6));
        r  = r << BigInt(8);
        r |= BigInt(this._file.charCodeAt(bytePos + 7));
        return r;
    }
}