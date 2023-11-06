

export type ReqWBufferSetMessage = {
    lut: Uint32Array;
    requestFrame: Uint32Array;
    dataPool: Uint16Array;
    LRUMap: Uint16Array;
    recvData: RecvData;
    pageSize: number;
};

export type RecvData = {
    recvRate: Float32Array;
    cachePointer: Uint32Array;
    pagesReceived: Uint32Array;
    pagesRequested: Uint32Array;
}

// response data types
export type ReqWResponse = {
    pointers: number[];
    nodes: bigint[];
};