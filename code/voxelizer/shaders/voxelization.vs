#version 450

layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aColor;
layout(location = 2) in vec2 aTexCoord;
layout (location = 3) in vec3 aNormal;

uniform ivec3 uResolution;
uniform mat4 uModel;

out VS_OUT {
    vec3 pos;
    vec4 color;
    vec2 texCoord;
    vec3 normal;
} vs_out;

void main()
{
    vec4 pos = uModel*vec4(aPos,1);
    gl_Position = pos - vec4(1,1,0,0);
    
    vs_out.pos = pos.xyz * uResolution;
    vs_out.color = aColor;
    vs_out.texCoord = aTexCoord;
    vs_out.normal = aNormal;
}