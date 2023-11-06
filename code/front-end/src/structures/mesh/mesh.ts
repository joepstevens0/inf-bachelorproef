import Shader from "../webgl/shader";
import { mat4, vec3 } from "gl-matrix";
import { BACK_END_PORT, MESH_MODEL_NAME, MESH_TEXTURE_NAME } from "../../constants";
import OBJLoader from "./objloader";

const VERTEX_SIZE = 8;

type Model = {
    vertices: [number, number, number][];
    texCoords: [number, number][];
    normals: [number, number, number][];
};

export default class Mesh{
    private _gl: WebGL2RenderingContext;

    private _vertexBuffer: WebGLBuffer | null = null;

    private _vertices = null as Float32Array | null;
    private _tex = null as WebGLTexture | null;

    private _init = false;
    public constructor(gl: WebGL2RenderingContext){
        this._gl = gl;

        this.init();
    }

    private async init(){
        const res: Response = await fetch("//localhost:"+ BACK_END_PORT +"/model/" + MESH_MODEL_NAME,
        {
            method: "GET",
        });
        const model: ArrayBuffer = await res.arrayBuffer();

        let url = null;

        if (MESH_TEXTURE_NAME){
            const imgeRes = await fetch("//localhost:"+ BACK_END_PORT +"/texture/" + MESH_TEXTURE_NAME,
            {
                method: "GET",
            });

            const image: Blob = await imgeRes.blob();
            url = URL.createObjectURL(image);
        }

        this.loadModel(model, url);
        this.createBuffers();
        this.fillBuffers();
        this._init = true;
    }

    /**
     * Draw the mesh on the currently bound framebuffer
     * @param aPosLoc Location of the position attribute on the shader
     * @param aTexCoordLoc Location of the texture coordinate attribute on the shader
     * @post Mesh is drawn with the currently bound shader
     * @pre aPosLoc and aTexCoordLoc are the correct locations on the shader
     */
    public draw(shader: Shader, size: number){
        if (!this._init) return;

        // set model matrix
        shader.bindUniformMat4("uModel", mat4.fromScaling(mat4.create(), vec3.fromValues(size, size, size)));

        // bind texture
        shader.bindUniform1i("uTexture", 0);
        this._gl.activeTexture(this._gl.TEXTURE0);
        this._gl.bindTexture(this._gl.TEXTURE_2D, this._tex);

        // bind the buffers
        const aPosLoc = shader.getAttrLocation("aPos");
        const aTexCoordLoc = shader.getAttrLocation("aTexCoord");
        const aNormalLoc = shader.getAttrLocation("aNormal");
        this.bindVertexBuffer(aPosLoc, aTexCoordLoc, aNormalLoc);

        // draw
        if (this._vertices)
            this._gl.drawArrays(this._gl.TRIANGLES, 0, this._vertices.length);
    }

    /**
     * Loads the model
     * @post this._vertices contains the vertices of the model
     * @post this._indices contains the indices of the model
     * @post this._tex contains the texture of the model
     * @post this._model contains a matrix that normalizes the mesh positions
     */
    private loadModel(buffer: ArrayBuffer, texturePath: string | null){
        this._vertices = OBJLoader.load(buffer);

        this.createTexture(texturePath);
    }

    /**
     * creates the texture
     * @post this._tex contains a webgl texture
     */
    private createTexture(texturePath: string | null){
        if (texturePath == null) return;

        const gl = this._gl;
        this._tex = gl.createTexture();

        const tex = this._tex;

        const image = new Image();
        image.onload = function() {
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                            gl.RGBA, gl.UNSIGNED_BYTE, image);
        
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        };
        image.src = texturePath;
    }

    private bindVertexBuffer(aPosLoc: number, aTexCoordLoc: number, aNormalLoc: number) {
        this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._vertexBuffer);

        // position attr
        this._gl.vertexAttribPointer(
            aPosLoc,
            3,
            this._gl.FLOAT,
            false,
            VERTEX_SIZE* 4,
            0
        );
        this._gl.enableVertexAttribArray(aPosLoc);

        // texcoord attr
        this._gl.vertexAttribPointer(
            aTexCoordLoc,
            2,
            this._gl.FLOAT,
            false,
            VERTEX_SIZE * 4,
            3 * 4
        );
        this._gl.enableVertexAttribArray(aTexCoordLoc);

        // normal attr
        this._gl.vertexAttribPointer(
            aNormalLoc,
            3,
            this._gl.FLOAT,
            false,
            VERTEX_SIZE * 4,
            5 * 4
        );
        this._gl.enableVertexAttribArray(aNormalLoc);
    }

    /**
     * Create the vertexbuffer
     * @post vertexbuffer is created
     * @throws Error message if failed to create a buffer
     */
    private createBuffers() {

        // create vertexbuffer
        this._vertexBuffer = this._gl.createBuffer();
        if (!this._vertexBuffer) {
            console.error("Failed to create mesh vertex buffer");
            throw "Failed to create mesh vertexbuffer";
        }
    }


    /**
     * Fill the vertex buffer
     * @post vertexbuffer is filled with mesh vertices
     * @post this._totalIndices contains the total number of indices
     */
    private fillBuffers() {
        
        // fill vertex buffer
        this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._vertexBuffer);
        this._gl.bufferData(this._gl.ARRAY_BUFFER, this._vertices, this._gl.STATIC_DRAW);
    }
}