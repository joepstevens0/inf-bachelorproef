
const QUAD_VERTICES = [
    1.0, 1.0,       1, 1,
    -1.0, 1.0,      0, 1,
    1.0, -1.0,      1, 0,
    -1.0, -1.0,     0, 0
];
const QUAD_INDICES = [
    0, 1, 2,
    1, 2, 3
];


export default class Quad{
    private _gl: WebGL2RenderingContext;

    private _vertexBuffer: WebGLBuffer | null = null;
    private _indexBuffer: WebGLBuffer | null = null;
    private _totalIndices = 0;

    public constructor(gl: WebGL2RenderingContext){
        this._gl = gl;

        this.createBuffers();
        this.fillBuffers();
    }

    /**
     * Draw the quad on the currently bound framebuffer
     * @param aPosLoc Location of the position attribute on the shader
     * @param aTexCoordLoc Location of the texture coordinate attribute on the shader
     * @post Quad is drawn with the currently bound shader
     * @pre aPosLoc and aTexCoordLoc are the correct locations on the shader
     */
    public draw(aPosLoc: number, aTexCoordLoc: number){
        // bind the buffers
        this.bindVertexBuffer(aPosLoc, aTexCoordLoc);
        this.bindIndexBuffer();

        // draw
        this._gl.drawElements(this._gl.TRIANGLES, this._totalIndices, this._gl.UNSIGNED_SHORT, 0);
    }

    private bindVertexBuffer(aPosLoc: number, aTexCoordLoc: number) {
        this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._vertexBuffer);

        // position attr
        this._gl.vertexAttribPointer(
            aPosLoc,
            2,
            this._gl.FLOAT,
            false,
            4* 4,
            0
        );
        this._gl.enableVertexAttribArray(aPosLoc);

        // texcoord attr
        this._gl.vertexAttribPointer(
            aTexCoordLoc,
            2,
            this._gl.FLOAT,
            false,
            4 * 4,
            2 * 4
        );
        this._gl.enableVertexAttribArray(aTexCoordLoc);
    }

    /**
     * Bind the indexbuffer of the quad
     * @post indexbuffer is bound
     */
    private bindIndexBuffer() {
        this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    }

    /**
     * Create the vertexbuffer and indexbuffer
     * @post vertexbuffer and indexbuffer are created
     * @throws Error message if failed to create a buffer
     */
    private createBuffers() {

        // create vertexbuffer
        this._vertexBuffer = this._gl.createBuffer();
        if (!this._vertexBuffer) {
            console.error("Failed to create Quad vertex buffer");
            throw "Failed to create Quad vertexbuffer";
        }

        // create indexbuffer
        this._indexBuffer = this._gl.createBuffer();
        if (!this._indexBuffer) {
            console.error("Failed to create Quad index buffer");
            throw "Failed to create Quad indexbuffer";
        }
    }


    /**
     * Fill the vertex and index buffers
     * @post vertexbuffer is filled with quad vertices
     * @post indexbuffer is filled with quad indices
     * @post this._totalIndices contains the total number of indices
     */
    private fillBuffers() {
        
        // fill vertex buffer
        this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._vertexBuffer);
        this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(QUAD_VERTICES), this._gl.STATIC_DRAW);

        // fill index buffer
        this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
        this._gl.bufferData(this._gl.ELEMENT_ARRAY_BUFFER, new Int16Array(QUAD_INDICES), this._gl.STATIC_DRAW);
        this._totalIndices = QUAD_INDICES.length;
    }
}