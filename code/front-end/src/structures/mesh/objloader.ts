

export type Model = {
    vertices: [number, number, number][];
    texCoords: [number, number][];
    normals: [number, number, number][];
};

type DataArrays = {
    vertices: [number, number, number][];
    texCoords: [number, number][];
    normals: [number, number, number][];
    faces: [number, number, number][];
};

const VERTEX_SIZE = 8;

export default class OBJLoader{


    public static load(data: ArrayBuffer): Float32Array{
        const arr: DataArrays = OBJLoader.loadModel(data);

        const res = new Float32Array(arr.faces.length*VERTEX_SIZE);

        let xmin = 0, ymin = 0, zmin = 0,xmax = 0, ymax = 0, zmax = 0;
        if (arr.vertices.length > 3){
            // initialize max and min positions
            xmin = arr.vertices[0][0]; xmax = arr.vertices[0][0];
            ymin = arr.vertices[0][1]; ymax = arr.vertices[0][1];
            zmin = arr.vertices[0][2]; zmax = arr.vertices[0][2];
        }

        let i = 0;
        arr.faces.forEach((value: [number, number, number])=>{
            let vertex = arr.vertices[value[0] - 1];
            let texCoord = arr.texCoords[value[1] - 1];
            let normal = arr.normals[value[2] - 1];

            if (vertex == undefined){
                vertex = [0,0,0];
            }
            if (texCoord == undefined){
                texCoord = [0,0];
            } 
            if (normal == undefined){
                normal = [0,0,0];
            }

            res[i*VERTEX_SIZE] = vertex[0];
            res[i*VERTEX_SIZE + 1] = vertex[1];
            res[i*VERTEX_SIZE + 2] = vertex[2];
            res[i*VERTEX_SIZE + 3] = texCoord[0];
            res[i*VERTEX_SIZE + 4] = 1 - texCoord[1];
            res[i*VERTEX_SIZE + 5] = normal[0];
            res[i*VERTEX_SIZE + 6] = normal[1];
            res[i*VERTEX_SIZE + 7] = normal[2];
            i += 1;

            xmin = Math.min(xmin, vertex[0]); xmax = Math.max(xmax, vertex[0]);
            ymin = Math.min(ymin, vertex[1]); ymax = Math.max(ymax, vertex[1]);
            zmin = Math.min(zmin, vertex[2]); zmax = Math.max(zmax, vertex[2]);
        });

        // normalize vertices
        const dMax = Math.max(xmax-xmin, ymax-ymin, zmax-zmin);
        for (let i = 0; i < res.length/VERTEX_SIZE;++i){
            res[i*VERTEX_SIZE] = (res[i*VERTEX_SIZE]  - xmin)/dMax;
            res[i*VERTEX_SIZE+1] = (res[i*VERTEX_SIZE+1] - ymin)/dMax;
            res[i*VERTEX_SIZE+2] = -1 + (res[i*VERTEX_SIZE+2]  - zmin)/dMax;
        }

        return res;
    }

    private static loadModel(data: ArrayBuffer): DataArrays{
        const arr: DataArrays = {
            vertices: [],
            texCoords: [],
            normals: [],
            faces: []
        };

        let buffer = "";
        const view = new Uint8Array(data);
        let i = 0;
        while (i < view.byteLength){
            const char: string = String.fromCharCode(view[i]);
            if (char == "\n"){
                this.parseLine(buffer, arr);
                buffer = "";
            }else {
                buffer += char;
            }
            ++i;
        }
        
        return arr;
    }

    private static parseLine(line: string, arr: DataArrays){
        if(line.startsWith("v ")){
            const numbers = this.readFloats(line.substr(line.indexOf(" ") + 1));
            arr.vertices.push(numbers as [number, number, number]);
        } else if(line.startsWith("vt ")){
            const numbers = this.readFloats(line.substr(line.indexOf(" ") + 1));
            arr.texCoords.push(numbers as [number, number]);
        } else if(line.startsWith("vn ")){
            const numbers = this.readFloats(line.substr(line.indexOf(" ") + 1));
            arr.normals.push(numbers as [number, number, number]);
        } else if(line.startsWith("f ")){
            const p = line.substr(line.indexOf(" ") + 1).split(" ");

            p.forEach((val: string)=>{
                const numberStrs = val.split("/");
                arr.faces.push([parseInt(numberStrs[0]), parseInt(numberStrs[1]), parseInt(numberStrs[2])]);
            });
        }
    }

    private static readFloats(data: string): number[]{
        const r = data.split(" ");
        const result = [] as number[];
        r.forEach((val: string)=>{
            result.push(parseFloat(val));
        });

        return result;
    }
}