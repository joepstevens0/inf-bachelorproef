import Shader from "../webgl/shader";

import vsSource from "raw-loader!@/shaders/mesh/meshshader.vs";
import fsSource from "raw-loader!@/shaders/mesh/meshshader.fs";
import Camera from "../camera/camera";
import Framebuffer from "../webgl/framebuffer";
import Mesh from "./mesh";
import Texture from "../webgl/texture";


export class MeshRender{
    private _gl: WebGL2RenderingContext;
    private _width = 0;
    private _height = 0;

    private _framebuffer: Framebuffer;
    private _colorTexIndex: number;
    private _shader: Shader;
    private _mesh: Mesh;
    private _camera: Camera;

    public constructor(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, camera: Camera){
        this._gl = gl;
        this._width = canvas.width;
        this._height = canvas.height;
        this._camera = camera;

        // create framebuffer
        this._framebuffer = new Framebuffer(gl, this._width, this._height);
        this._colorTexIndex = this._framebuffer.addColorTex(gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
        this._framebuffer.addDepthBuffer();
        this._framebuffer.bind();

        this._shader = new Shader(gl, vsSource, fsSource);
        this._mesh = new Mesh(gl);

    }

    public render(size: number): Texture{
        this._gl.enable(this._gl.DEPTH_TEST);
        this._gl.depthFunc(this._gl.LEQUAL);
        this._framebuffer.bind();

        this._shader.bind();

        this._gl.viewport(0, 0, this._width, this._height);

        this._camera.bind(this._shader);

        this._gl.clearColor(0.1,0.1,0.1,0);
        this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
        
        // draw the quad
        this._mesh.draw(this._shader, size);

        return this._framebuffer.getColorTex(this._colorTexIndex);
    }
}