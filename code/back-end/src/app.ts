import express from 'express';
import cors from 'cors';
import ws from 'ws';
import Producer from './Producer';
import * as fs from "fs";
import { FILENAME, OPTIMIZED_SVO, PAGESIZE, PORT, TROTTLE } from './constants';

const app = express();
app.use(cors());
app.use(express.raw({type: 'application/octet-stream'}));

const producer = new Producer(FILENAME, PAGESIZE, OPTIMIZED_SVO);

const wss = new ws.Server({noServer: true});

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send pages to the client socket
 * @param socket of the client
 * @param pages sending
 * @post pages are send to the client on socket <socket>
 */
function sendPages(socket: WebSocket, pages: BigUint64Array[]){
    if (pages.length <= 0) return;

    // send nodes
    const allpages = [];
    for (let i = 0 ; i < pages.length;++i){
        allpages.push(...pages[i]);
    }
    const buffer = new BigUint64Array(allpages);
    socket.send(buffer);
}

wss.on("connection", (socket: WebSocket)=>{
    socket.binaryType = 'arraybuffer';

    socket.onmessage = async (message: MessageEvent)=>{
        await sleep(TROTTLE);

        // parse request pointers
        const data = message.data as ArrayBuffer;
        const view = new DataView(data);

        const pages = [];

        for (let i = 0; i < view.byteLength;i+=4){
            const req = view.getInt32(i, true);

            try{
                const page = producer.request(req);
                pages.push(page);

            } catch(e){
                console.log("Error retreiving page:", req);
                return;
            }
        }

        sendPages(socket, pages);
    };
});

app.post("/xmlhttpreq", async (req, res) => {
    await sleep(TROTTLE);

    const view = Buffer.from(req.body) ;
    const pages = [];

    for (let i = 0; i < view.byteLength;i+=4){
        const request = view.readUInt32LE(i);

        try{
            const page = producer.request(request);
            pages.push(page);
        } catch(e){
            console.log("Error retreiving page", request);
            return;
        }
    }

    if (pages.length <= 0) return;

    // send nodes
    const allpages = [];
    for (let i = 0 ; i < pages.length;++i){
        allpages.push(...pages[i]);
    }
    const buffer = new BigUint64Array(allpages);

    res.type('application/octet-stream');
    res.write(new Uint8Array(buffer.buffer));
    res.end();
});
app.get("/node/:nodeNumber", (req, res) => {


    try{
        const page = producer.request(Number(req.params.nodeNumber as string));
        res.type('text/plain');
        res.write(page.toString());
        res.end();
    } catch(e){
        console.log("Error retreiving page", Number(req.params.nodeNumber as string), e);
        return;
    }
});

app.get("/totalpages", (req, res)=>{
    res.type("text/plain")
    res.write(producer.totalPages().toString());
    res.end();
});

app.get("/model/:modelname", (req, res)=>{
    res.set({
        "Content-Type": "text/plain"
    });
    const data = fs.readFileSync(__dirname + "/mesh/"+ req.params.modelname);
    res.type('application/octet-stream');
    res.write(data);
    res.end();
});
app.get("/texture/:texname", (req, res)=>{
    res.sendFile(__dirname + "/mesh/"+ req.params.texname);
});

const server = app.listen(PORT);

server.on('upgrade', (request: any, socket: any, head: any) => {
    wss.handleUpgrade(request, socket, head, sock => {
        wss.emit('connection', sock, request);
    });
});

console.log( `server started at http://localhost:${ PORT }` );