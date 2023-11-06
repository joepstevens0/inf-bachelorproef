#version 450

layout (location = 0) out vec4 FragColor;

// Voxel output
layout(rgba8, binding = 0) uniform image3D outTex;
layout(rgba32f, binding = 1) uniform image3D outNormals;

uniform ivec3 uResolution;
uniform sampler2D uTex;
uniform bool uHasTex;

in GS_OUT{
	vec3 pos;
    vec4 color;
    vec2 texCoord;
    vec3 normal;
} fs_in;

void main()
{
    vec4 oldColor = imageLoad(outTex, ivec3(fs_in.pos - vec3(0.25,0.25,0.25)));
    if (oldColor.a > 0.){
        return;
    }

    vec4 color;
    
    if (uHasTex){
        color = texture(uTex,fs_in.texCoord);
    }else{
        color = fs_in.color;
    }

    imageStore(outTex, ivec3(fs_in.pos - vec3(0.25,0.25,0.25)), color);
    imageStore(outNormals, ivec3(fs_in.pos - vec3(0.25,0.25,0.25)), vec4(fs_in.normal, 1));
    FragColor = color;
}