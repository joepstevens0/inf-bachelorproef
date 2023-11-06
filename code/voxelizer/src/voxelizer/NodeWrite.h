#ifndef NODEWRITE_H
#define NODEWRITE_H

#include <vector>
#include "structs.h"
#include <fstream>

class NodeWrite
{
public:
    static void writeNode(std::ofstream &SVOout, Node node);
    static void writeRefer(std::ofstream &SVOout,uint64_t offset);
    static void flush(std::ofstream &out);
private:
    static void writeBit(std::ofstream &out, bool bit);
    static uint8_t writeBuffer;
    static uint8_t writeBufferIndex; 
};

#endif