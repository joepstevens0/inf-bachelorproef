


export default class Texture{

    private _tex: WebGLTexture;
    private _gl: WebGL2RenderingContext;

    /**
     * creates the texture
     * @param width of the texture
     * @param height of the texture
     * @returns the texture
     */
     public constructor(gl: WebGL2RenderingContext,width: number, height: number, internalformat: number, format: number, type: number) {
         this._gl = gl;

        // create texture
        const tex = gl.createTexture();
        if (!tex) {
            console.error("Failed to create texture");
            throw "Failed to create texture";
        }
        this._tex = tex;

        // bind the texture
        gl.bindTexture(gl.TEXTURE_2D, this._tex);

        // fill texture with correct format
        const level = 0;
        const border = 0;
        const data = null;
        gl.texImage2D(
            gl.TEXTURE_2D,
            level,
            internalformat,
            width,
            height,
            border,
            format,
            type,
            data
        );

        // set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    /**
     * @returns the WebGLTexture for this texture
     */
    public get(): WebGLTexture{
        return this._tex;
    }

    /**
     * Bind the texture to a slot
     * @param slot number for the texture
     * @pre slot < 32
     * @post texture is bound to slot <slot>
     */
    public bind(slot: number){
        this._gl.activeTexture(this._gl.TEXTURE0 + slot);
        this._gl.bindTexture(this._gl.TEXTURE_2D, this.get());
    }
}