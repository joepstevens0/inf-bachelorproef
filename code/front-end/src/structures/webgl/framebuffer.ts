import Texture from "./texture";


export default class Framebuffer {
    private _gl: WebGL2RenderingContext;
    private _width = 0;
    private _height = 0;

    private _colorTextures = [] as Texture[];
    private _framebuffer: WebGLFramebuffer;
    private _renderbuffer: WebGLRenderbuffer| null = null;

    /**
     * @param gl: WebGL context
     * @param width: width of the framebuffer
     * @param height: height of the framebuffer
     */
    constructor(gl: WebGL2RenderingContext, width: number, height: number) {
        this._gl = gl;
        this._width = width;
        this._height = height;
        

        // create framebuffer
        const framebuffer = gl.createFramebuffer();
        if (framebuffer === null) {
            console.error("Failed to create framebuffer");
            throw "Failed to create framebuffer";
        }

        this._framebuffer = framebuffer;
    }

    /**
     * Adds a color texture to the framebuffer
     * @post an extra color texture is added to the framebuffer
     * @returns the color texture
     */
    public addColorTex(internalformat: number, format: number, type: number): number{
        const gl = this._gl;

        const index = this._colorTextures.length;

        // create color texture
        const colorTex = new Texture(gl,this._width, this._height, internalformat, format, type);

        // bind the framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);

        // bind color texture to framebuffer
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0 + index,
            gl.TEXTURE_2D,
            colorTex.get(),
            0
        );

        // add texture to list
        this._colorTextures.push(colorTex);

        // update framembuffer attachements
        const attachments = [];
        for (let i = 0;i < this._colorTextures.length;++i)
            attachments.push(gl.COLOR_ATTACHMENT0 + i);
        gl.drawBuffers(attachments);

        return index;
    }
    /**
     * Adds a depth buffer to the framebuffer
     * @post a depth buffer is added to the framebuffer
     * @pre framebuffer does not yet contain a depth buffer
     */
    public addDepthBuffer(){
        const gl = this._gl;

        // bind the framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);

        this._renderbuffer = gl.createRenderbuffer();
        if (!this._renderbuffer) {
            throw "Failed to create depth buffer";
        }

        gl.bindRenderbuffer(gl.RENDERBUFFER, this._renderbuffer);
        
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, this._width, this._height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this._renderbuffer);
    }

    /**
     * bind the framebuffer
     * @post Framebuffer is used for next draw
     */
    public bind() {
        this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, this._framebuffer);
    }

    /**
     * @returns a color texture of the framebuffer by index
     * @param index of the color texture
     */
    public getColorTex(index: number): Texture {
        return this._colorTextures[index];
    }
}