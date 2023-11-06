import { mat3, mat4, vec2, vec3 } from "gl-matrix";


export default class Shader{
    private _gl: WebGL2RenderingContext;
    private _shaderProgram = {} as WebGLProgram;


    public constructor(gl: WebGL2RenderingContext, vsSource: string, fsSouce: string) {
        this._gl = gl;
        
        // create shader program
        this.initShaderProgram(vsSource, fsSouce);
    }

    /**
     * Bind a uniform to an integer
     * @param name of the uniform
     * @param data: integer binding to the uniform
     * @pre data is an integer
     * @pre <name> is the name of an integer uniform on the shader
     * @post <data> is bound to the uniform with name <name>
     */
    public bindUniform1i(name: string, data: number){
        this._gl.uniform1i(
            this.getUniformLocation(name),
            data
        );
    }

    /**
     * Bind a uniform to an float
     * @param name of the uniform
     * @param data: float binding to the uniform
     * @pre data is an float
     * @pre <name> is the name of an float uniform on the shader
     * @post <data> is bound to the uniform with name <name>
     */
    public bindUniform1f(name: string, data: number){
        this._gl.uniform1f(
            this.getUniformLocation(name),
            data
        );
    }

    public bindUniform1ui(name: string, data: number){
        this._gl.uniform1ui(
            this.getUniformLocation(name),
            data
        );
    }

    public bindUniformiVec2(name: string, x: number, y: number) {
        this._gl.uniform2i(
            this.getUniformLocation(name),
            x,y
        );
    }

    public bindUniformVec2(name: string, data: vec2) {
        this._gl.uniform2fv(
            this.getUniformLocation(name),
            data
        );
    }
    public bindUniformVec3(name: string, data: vec3) {
        this._gl.uniform3fv(
            this.getUniformLocation(name),
            data
        );
    }
    public bindUniformMat3(name: string, data: mat3) {
        this._gl.uniformMatrix3fv(
            this.getUniformLocation(name),
            false,
            data
        );
    }
    public bindUniformMat4(name: string, data: mat4) {
        this._gl.uniformMatrix4fv(
            this.getUniformLocation(name),
            false,
            data
        );
    }

    /**
     * Get the location of an attribute on the shader
     * @param name of the attribute
     * @returns location of the attribute on the shader
     */
    public getAttrLocation(name: string): number {
        return this._gl.getAttribLocation(this._shaderProgram, name);
    }

    /**
     * bind the shader
     * @post shader is currently used
     */
    public bind() {
        this._gl.useProgram(this._shaderProgram);
    }

    /**
     * Returns the location of a uniform
     * @param name of the uniform
     * @returns WebGLUniformLocation with location of uniform with name <name> or null if uniform not found
     */
    private getUniformLocation(name: string): WebGLUniformLocation | null {
        return this._gl.getUniformLocation(this._shaderProgram, name);
    }

    /**
     * Creates the shader program for a vertex source code and fragment shader source code
     * @param vsSource source code of the vertex shader
     * @param fsSource source code of the fragment shader
     * @post the shaderprogram is created
     */
    private initShaderProgram(vsSource: string, fsSource: string): void {
        const gl = this._gl;

        // load shaders
        const vertexShader = Shader.loadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = Shader.loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

        // test if shaders succesfully created
        if (!vertexShader || !fragmentShader) {
            console.error("Failed to create shader program");
            throw "Failed to create shader program";
        }

        // create the program
        const shaderProgram = gl.createProgram();
        if (!shaderProgram) {
            console.error("Failed to create shader program");
            throw "Failed to create shader program";
        }

        // add shaders to the program
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        // test if shader link was successfull
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
            gl.deleteProgram(shaderProgram);
            throw "Failed to create shader program";
        }

        // update shaderprogram member variable
        this._shaderProgram = shaderProgram;
    }

    /**
     * Create a shader of a given type with a source string
     * @param gl the rendering context
     * @param type of the shader
     * @param source code of the shader
     * @returns the null WebGLShader or null if failed to create the shader
     */
    private static loadShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {

        // create the shader
        const shader = gl.createShader(type);

        // test if succesfully created
        if (!shader) {
            console.error("Failed to create shader");
            return null;
        }

        // set the source for the shader and compile
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        // test is shader compulation was succesfull
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader); 
            return null;
        }

        return shader;
    }
}