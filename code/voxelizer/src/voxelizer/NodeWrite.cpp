#include "NodeWrite.h"
#include <iostream>

uint8_t NodeWrite::writeBuffer{0};
uint8_t NodeWrite::writeBufferIndex{0}; 

void NodeWrite::writeNode(std::ofstream &SVOout, Node node)
{

    // write childbits
    for (int i = 7; i >= 0;--i){
        writeBit(SVOout, node.childBits & (1 << i));
    }

    // write refer bit
    writeBit(SVOout, node.referBit);

    // write childoffset
    for (int i = 22; i >= 0;--i){
        writeBit(SVOout, node.childOffset & (1 << (i )));
    }

    // write RGBA
    for (int i = 7; i >= 0;--i){
        writeBit(SVOout, node.RGBA.R & (1 << i));
    }
    for (int i = 7; i >= 0;--i){
        writeBit(SVOout, node.RGBA.G & (1 << i));
    }
    for (int i = 7; i >= 0;--i){
        writeBit(SVOout, node.RGBA.B & (1 << i));
    }
    for (int i = 7; i >= 0;--i){
        writeBit(SVOout, node.RGBA.A & (1 << i));
    }
}

void NodeWrite::writeRefer(std::ofstream &SVOout,uint64_t offset)
{
    // write offset
    for (int i = 63; i >= 0;--i){
        writeBit(SVOout, offset & ((uint64_t)1 << (i )));
    }
}

void NodeWrite::writeBit(std::ofstream &out, bool bit)
{
    // add bit to writebuffer
    writeBuffer |= (bit << (7-writeBufferIndex));

    // prepare for next bit
    writeBufferIndex += 1;

    // if writebuffer full, write the buffer
    if (writeBufferIndex >= 8){
        out.write((const char*)&writeBuffer, 1);
        writeBufferIndex = 0;
        writeBuffer = 0;
    }
}

void NodeWrite::flush(std::ofstream &out)
{
    // write 0 bits until writebuffer empty
    while(writeBufferIndex != 0){
        writeBit(out, 0);
    }
}