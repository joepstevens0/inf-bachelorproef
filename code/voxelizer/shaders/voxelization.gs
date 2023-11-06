#version 450

uniform int uSwizzle;

// inputs from vertex shader
layout(triangles) in;
layout(triangle_strip, max_vertices = 3) out;

in VS_OUT{
	vec3 pos;
	vec4 color;
	vec2 texCoord;
	vec3 normal;
} gs_in[];

out GS_OUT{
	vec3 pos;
	vec4 color;
	vec2 texCoord;
	vec3 normal;
} gs_out;

uniform ivec3 uResolution;

struct SwizzleResult
{
	vec3 v0;
	vec3 v1;
	vec3 v2;
};

// Voxel output
layout(rgba8, binding = 0) uniform image3D outTex;

void writeVoxel(ivec3 pos, vec4 color)
{
	imageStore(outTex, pos, color);
}

SwizzleResult swizzle(vec3 v0, vec3 v1, vec3 v2)
{
	SwizzleResult result;
	vec3 normal = cross(v1 - v0, v2 - v0);

	vec3 absNorm = abs(normal);

	if(absNorm.x >= absNorm.y && absNorm.x >= absNorm.z)			
	{													
		// YZ plane
		result.v0.xyz = v0.yzx;
		result.v1.xyz = v1.yzx;
		result.v2.xyz = v2.yzx;

	}
	else if(absNorm.y >= absNorm.x && absNorm.y >= absNorm.z)		
	{													
		// ZX plane

		result.v0.xyz = v0.zxy;
		result.v1.xyz = v1.zxy;
		result.v2.xyz = v2.zxy;
	}
	else												
	{													
		// XY plane

		result.v0.xyz = v0.xyz;
		result.v1.xyz = v1.xyz;
		result.v2.xyz = v2.xyz;
	}

	return result;
}

void emitVertex(uint index, vec3 v, vec4 pos){
	gl_Position = pos;
	gs_out.pos = v;
	gs_out.color = gs_in[index].color;
	gs_out.texCoord = gs_in[index].texCoord;
	gs_out.normal = gs_in[index].normal;
	EmitVertex();
}

void emitTriangle(vec3 v0, vec3 v1, vec3 v2)
{
	vec3 p0 = vec3(gl_in[0].gl_Position);
	vec3 p1 = vec3(gl_in[1].gl_Position);
	vec3 p2 = vec3(gl_in[2].gl_Position);

	if(uSwizzle == 0){
		SwizzleResult r = swizzle(p0,p1,p2);
		emitVertex(0 ,v0,vec4(r.v0,1));
		emitVertex(1 ,v1,vec4(r.v1,1));
		emitVertex(2 ,v2,vec4(r.v2,1));
	} else if(uSwizzle == 1){
		// XY plane
		emitVertex(0 ,v0,vec4(p0.xyz,1));
		emitVertex(1 ,v1,vec4(p1.xyz,1));
		emitVertex(2 ,v2,vec4(p2.xyz,1));
	}else if (uSwizzle == 2){
		// YZ plane
		emitVertex(0 ,v0,vec4(p0.yzx,1));
		emitVertex(1 ,v1,vec4(p1.yzx,1));
		emitVertex(2 ,v2,vec4(p2.yzx,1));
	} else if (uSwizzle == 3){
		// ZX plane
		emitVertex(0 ,v0,vec4(p0.zxy,1));
		emitVertex(1 ,v1,vec4(p1.zxy,1));
		emitVertex(2 ,v2,vec4(p2.zxy,1));
	}
}

void main()
{
	vec3 v0 = gs_in[0].pos;
	vec3 v1 = gs_in[1].pos;
	vec3 v2 = gs_in[2].pos;
	vec3 normal;

	// emit the triangle for the fragment shader
	emitTriangle(v0,v1,v2);
}