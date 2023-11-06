precision highp float;

struct Camera{
    vec3 pos;
    mat3 rot;
    float fov;
    mat4 view;
    mat4 proj;
};

uniform Camera uCamera;
uniform mat4 uModel;

attribute vec3 aPos;
attribute vec2 aTexCoord;
attribute vec3 aNormal;

varying vec2 vTexCoord;
varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vCamPos;


void main() {
    gl_Position = uCamera.proj*uCamera.view*uModel*vec4(aPos, 1);
    vTexCoord = aTexCoord;
    vNormal = aNormal;
    vPos = (uModel*vec4(aPos, 1)).xyz;
    vPos.z = -vPos.z;
    vCamPos = uCamera.pos;
}