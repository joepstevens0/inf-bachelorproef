import SVOFileLoader from "./SVOFileLoader";


export default class Producer
{

    private _loader;
    private _pageSize;


    public constructor(path: string, pageSize: number, optimizedSVO: boolean){
        this._pageSize = pageSize;
        this._loader = new SVOFileLoader(path,optimizedSVO);

        console.log("File size:", this._loader.fileSize());
    }

    public totalPages(): number{
        return this._loader.totalPages(this._pageSize);
    }

    /**
     * Get a page by number
     * @param pagePointer: number of the page
     * @returns the page with number <pagePointer>
     */
    public request(pagePointer: number): BigUint64Array{
        return this._loader.loadPage(pagePointer, this._pageSize);
    }
}