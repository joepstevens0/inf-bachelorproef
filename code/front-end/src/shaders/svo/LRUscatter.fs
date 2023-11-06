#version 300 es
precision highp float;

layout (location = 0) out uint LRUMap;
uniform highp uint uTimeStamp;

void main() {
    LRUMap = uTimeStamp;
}