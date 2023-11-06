#ifndef SVOSAVER_H
#define SVOSAVER_H

#include "SVO.h"

class SVOSaver
{
public:
    struct ShaderElement{
        unsigned int children : 8;
        unsigned int childPointer: 24;
        unsigned int RGBA: 32;
    };

    static void save(const char* output_file, SVO svo);
    static void saveOpt(const char* output_file, SVO svo);

private:

    static std::vector<ShaderElement> toShaderElements(SVO::NestedElement nestedEl);

    static void saveElement(std::ofstream &out, ShaderElement el, unsigned int childPointerSize, unsigned int colorSize);

    static void calcChildPSizeRanges(const std::vector<ShaderElement> elements, std::vector<unsigned int>& childPSizeUpdates, unsigned int& maxBits);
    static void calcColorIds(std::vector<ShaderElement>& elements,std::vector<unsigned int>& colors, unsigned int& maxBits);
    

    static uint8_t writeBuffer;
    static uint8_t writeBufferIndex;
    static void writeBit(std::ofstream &out, bool bit);
    static void flush(std::ofstream &out);
};

#endif