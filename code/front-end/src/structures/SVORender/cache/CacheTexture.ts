import { ptimer } from "../../ptimer";
import Shader from "../../webgl/shader";

const LUT_ELEMENT_SIZE = 3;     // amount of UI32 for each LUT element

export default class CacheTexture{
    private _gl: WebGL2RenderingContext;

    private _dataPoolWidth: number;
    private _dataPoolHeight: number;
    private _LUTWidth: number;
    private _LUTHeight: number;
    private _svoTex: WebGLTexture | null = null;
    private _svoLUTTex: WebGLTexture | null = null;
    private _pageSize: number;

    private _dataPoolPBO: WebGLBuffer | null = null;
    private _lutPBO: WebGLBuffer | null = null;

    public constructor(gl: WebGL2RenderingContext, dataPoolSize: number, LUTSize: number, pageSize: number){
        this._gl = gl;
        this._dataPoolWidth = Math.ceil(Math.sqrt(dataPoolSize*pageSize));
        this._dataPoolHeight = this._dataPoolWidth;

        this._LUTWidth = Math.ceil(Math.sqrt(LUTSize));
        this._LUTHeight = this._LUTWidth;

        this._pageSize = pageSize;

        this.createPBO();
        this.createSVOTex();
        this.createSVOLUTTex();

        console.debug("Created data pool with size:", this.dataPoolSize());
        console.debug("Created lookup table with size:", this.lutSize());
    }

    /**
     * @returns total elements in LUT
     */
    public lutSize(): number{
        return this._LUTHeight * this._LUTWidth;
    }
    /**
     * @returns size of the data pool in elements 
     */
    public dataPoolSize(): number{
        return Math.ceil(this._dataPoolWidth*this._dataPoolHeight/this._pageSize);
    }

    /**
     * bind the cache uniforms and textures to a shader
     * @param shader binding to
     * @post cache textures and uniforms are bound to <shader>
     */
    public bind(shader: Shader){
        const gl = this._gl;

        shader.bindUniform1i("uDataPool", 1);
        shader.bindUniform1i("uNodeLUT", 2);
        shader.bindUniform1ui("uDataPoolWidth", this._dataPoolWidth);
        shader.bindUniform1ui("uLUTWidth", this._LUTWidth);
        shader.bindUniform1ui("uLUTHeight", this._LUTHeight);
        shader.bindUniform1ui("uPageSize", this._pageSize);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._svoTex);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this._svoLUTTex);
    }

    /**
     * Updates the data pool and LUT texture with the current data pool and LUT values
     * @param dataPool values for the data pool texture
     * @param lut values for the LUT texture
     * @pre <dataPool> is the same size as the dataPoolSize()*4*this._pageSize
     * @pre <lut> is the same size as the lutSize()
     * @post dataPool texture is updated with new values from <dataPool>
     * @post LUT texture is updated with new values from <lut>
     */
    public update(lut: Uint32Array, dataPool: Uint16Array){
        ptimer.startOp("Data pool update");
        this.updateDataPoolTex(dataPool);
        ptimer.endOp("Data pool update");
        ptimer.startOp("LUT update");
        this.updateLUTTex(lut);
        ptimer.endOp("LUT update");
    }

    private fence: WebGLSync | null = null;
    /**
     * Updates the data pool texture with the new data pool values
     * @param dataPool values for the data pool texture
     * @pre <dataPool> is the same size as the texture
     * @post data pool texture is updated with new values from <dataPool>
     */
    private updateDataPoolTex(dataPool: Uint16Array){
        const gl = this._gl;

        if (this.fence != null){
            // check sync object status
            const status = gl.clientWaitSync(this.fence, 0, 0);
            switch (status) {
                case gl.TIMEOUT_EXPIRED:
                    // not yet done
                    return false;
                case gl.WAIT_FAILED:
                    console.error("Failed to wait on sync");
                    break;
                default:
                    break;
            }
            // sync is done, delete sync object
            gl.deleteSync(this.fence);
            this.fence = null;

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this._svoTex);
            gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, this._dataPoolPBO);
            gl.texSubImage2D(gl.TEXTURE_2D, 0,0, 0,  this._dataPoolWidth, this._dataPoolHeight, gl.RGBA_INTEGER, gl.UNSIGNED_SHORT, 0);
            gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
        }

        

        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, this._dataPoolPBO);
        gl.bufferData(gl.PIXEL_UNPACK_BUFFER, dataPool, gl.STREAM_DRAW);
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);

        this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
    }

    private fence2: WebGLSync | null = null;

    /**
     * Updates the LUT texture with the new LUT values
     * @param lut values for the LUT texture
     * @pre <lut> is the same size as the texture
     * @post LUT texture is updated with new values from <lut>
     */
    private updateLUTTex(lut: Uint32Array){
        const gl = this._gl;

        if (this.fence2 != null){
            // check sync object status
            const status = gl.clientWaitSync(this.fence2, 0, 0);
            switch (status) {
                case gl.TIMEOUT_EXPIRED:
                    // not yet done
                    return false;
                case gl.WAIT_FAILED:
                    console.error("Failed to wait on sync");
                    break;
                default:
                    break;
            }
            // sync is done, delete sync object
            gl.deleteSync(this.fence2);
            this.fence2 = null;

            gl.activeTexture(gl.TEXTURE3);
            gl.bindTexture(gl.TEXTURE_2D, this._svoLUTTex);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
            gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, this._lutPBO);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, LUT_ELEMENT_SIZE*this._LUTWidth, this._LUTHeight, gl.RED_INTEGER, gl.UNSIGNED_INT, 0);
            gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
            
        }

        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, this._lutPBO);
        gl.bufferData(gl.PIXEL_UNPACK_BUFFER, lut, gl.STREAM_DRAW);
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);


        this.fence2 = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
    }

    private createSVOTex(){
        const gl = this._gl;

        this._svoTex = gl.createTexture();

        // Bind texture
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._svoTex);

        // format texture
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16UI,this._dataPoolWidth, this._dataPoolHeight, 0, gl.RGBA_INTEGER, gl.UNSIGNED_SHORT, null);

        // set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    private createSVOLUTTex(){
        const gl = this._gl;

        this._svoLUTTex = gl.createTexture();

        // Bind texture
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this._svoLUTTex);

        // format texture
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32UI,LUT_ELEMENT_SIZE*this._LUTWidth, this._LUTHeight, 0, gl.RED_INTEGER, gl.UNSIGNED_INT, null);

        // set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    private createPBO(){
        const gl = this._gl;

        this._dataPoolPBO = gl.createBuffer();
        this._lutPBO = gl.createBuffer();
    }
}