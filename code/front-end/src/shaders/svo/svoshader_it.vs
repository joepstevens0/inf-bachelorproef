#version 300 es
precision mediump float;

in vec2 aPos;
in vec2 aTexCoord;

out vec2 vUv;

void main() {
    gl_Position = vec4(aPos, 0, 1);

    // transform origin to center of the screen
    vUv = aTexCoord - vec2(0.5,0.5);
}