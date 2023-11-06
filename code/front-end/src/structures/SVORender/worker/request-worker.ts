import { ReqWBufferSetMessage } from "./requestworkertypes";
import PageRequester from "../pagestream/PageRequester";
import PageLoader from "../pagestream/PageLoader";
import { PageData } from "../pagestream/senders/requester";
import { LRU_MARK, LRU_TRESH } from "../../../constants";

const context: Worker = self as any;


let requester: PageRequester;
let loader: PageLoader;

const markLRU = function(dataPool: Uint16Array, LRU: Uint16Array, pageSize: number){
    for (let i = 0; i < LRU.length;++i){
        const mark = Math.abs(LRU[i] - LRU[0]) > LRU_TRESH;
        for (let j = 0; j < pageSize;++j){
            if (!(dataPool[4*(pageSize*i + j)] & 0x80)){
                dataPool[4*(pageSize*i + j) + 2] = Number(mark)*255;
            }
        }
    }
} 

context.addEventListener("message", (e) => {

    const buffers = e.data as ReqWBufferSetMessage;

    loader = new PageLoader(buffers.dataPool, buffers.lut, buffers.LRUMap, buffers.pageSize, buffers.recvData);
    const onLoad = (page: PageData)=>{
        if (LRU_MARK){
            // mark new nodes green
            for (let i = 0; i < page.data.length;++i){
                if (!((page.data[i] & 0x08000000000000n) > 0n))
                    page.data[i] = page.data[i] | 0x00FF0000n;
            }
        }

        loader.loadPage(page);
    };
    requester = new PageRequester(buffers.lut, buffers.requestFrame, buffers.pageSize, onLoad, buffers.recvData);

    // start the request loop
    const startRequestLoop = function(){
        requester.update();

        if (LRU_MARK)
            markLRU(buffers.dataPool, buffers.LRUMap, buffers.pageSize);

        setTimeout(startRequestLoop);
    }
    startRequestLoop();
    
});
