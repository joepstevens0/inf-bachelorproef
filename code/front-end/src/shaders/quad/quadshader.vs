precision mediump float;

attribute vec2 aPos;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

uniform vec2 uOffset;

void main() {
    gl_Position =vec4(aPos + uOffset, 0, 1);
    vTexCoord = aTexCoord;
}