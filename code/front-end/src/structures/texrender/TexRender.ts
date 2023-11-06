import Shader from "../webgl/shader";
import Quad from "../mesh/quad";

import vsSource from "raw-loader!@/shaders/quad/quadshader.vs";
import fsSource from "raw-loader!@/shaders/quad/quadshader.fs";
import Texture from "../webgl/texture";
import { vec2 } from "gl-matrix";

export default class TexRender{
    private _gl: WebGL2RenderingContext;

    private _shader: Shader;
    private _quad: Quad;
    
    
    public constructor(gl: WebGL2RenderingContext){
        this._gl = gl;
        this._shader = new Shader(gl, vsSource, fsSource);
        this._quad = new Quad(gl);
    }

    /**
     * Renders a texture to the current framebuffer
     * @param texture rendering to the framebuffer
     * @post texture is rendered to current bound framebuffer
     */
    public render(texture: Texture, offset: vec2 = [0,0]){
        this._shader.bind();

        // bind the texture
        this._gl.activeTexture(this._gl.TEXTURE0);
        this._gl.bindTexture(this._gl.TEXTURE_2D, texture.get());
        this._shader.bindUniform1i("uSampler", 0);
        this._shader.bindUniformVec2("uOffset", offset);

        // draw the quad
        const aPosLoc = this._shader.getAttrLocation("aPos");
        const aTexCoordLoc = this._shader.getAttrLocation("aTexCoord");
        this._quad.draw(aPosLoc, aTexCoordLoc);
    }

}