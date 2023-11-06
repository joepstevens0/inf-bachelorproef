#include "SVOSaver.h"

#include <queue>
#include <iostream>
#include <tgmath.h>
#include <algorithm>
#include <unordered_map>
#include <utility>

uint8_t SVOSaver::writeBuffer{0};
uint8_t SVOSaver::writeBufferIndex{0};

std::vector<SVOSaver::ShaderElement> SVOSaver::toShaderElements(SVO::NestedElement nestedEl)
{
    std::cout << " Transforming nested to 1D array...\n";
    std::vector<ShaderElement> shaderNodes;

    std::queue<SVO::NestedElement> nodeStack; // nodes that need adding
    struct ParentStackEl{SVO::NestedElement parent;unsigned int parentPointer;};
    std::queue<ParentStackEl> parentStack;   // parents whose children need adding

    nodeStack.push(nestedEl);

    unsigned int totalNodes = 0;

    while(nodeStack.size() > 0 || parentStack.size() > 0){
        // nodeStack needs to be emptied first
        if (nodeStack.size() > 0){
            // take the first element from the node stack
            SVO::NestedElement node = nodeStack.front();
            nodeStack.pop();

            unsigned int RGBA = (node.R << 24) | (node.G << 16)| (node.B << 8)| node.A;
            ShaderElement el = {
                 0,
                node.children.size() > 0? totalNodes + 1 : 0,
                RGBA
            };

            if (node.children.size() > 0){
                // create children mask
                for (unsigned int i = 0; i < node.children.size();++i){
                    if (!node.children[i].isEmpty)
                        el.children |= (1 << i);
                }
                parentStack.push(ParentStackEl{node, totalNodes});
            } else{
                if (node.isEmpty){
                    el.children = 0;
                } else{
                    el.children = 255;
                }
            }

            // add the shadernode
            shaderNodes.push_back(el);

            totalNodes += 1;
        }else{
            // take the first element from the parent stack
            ParentStackEl item = parentStack.front();
            parentStack.pop();

            // add child offset pointer
            shaderNodes[item.parentPointer].childPointer = totalNodes - item.parentPointer;
            for (unsigned int i = 0; i < item.parent.children.size();++i){
                if (!item.parent.children[i].isEmpty)
                    nodeStack.push(item.parent.children[i]);
            }
        }
    }

    return shaderNodes;
}

void SVOSaver::calcChildPSizeRanges(const std::vector<ShaderElement> elements, std::vector<unsigned int>& childPSizeUpdates, unsigned int& maxBits)
{
    std::cout << " Creating childpointersize rangelist...\n";
    maxBits = 1;
    for (unsigned int i = 0; i < elements.size();++i){

        // calculate max bits needed
        const unsigned int childPBitsNeeded = log2(elements[i].childPointer) + 1;
        if (childPBitsNeeded > maxBits){
            maxBits = maxBits + 1;
            childPSizeUpdates.push_back(i);

            // test element again element
            i -= 1;
        }
    }
    std::cout << " Childpointersize rangelist created, maxChildPointer: " << maxBits << "\n";
}

void SVOSaver::calcColorIds(std::vector<ShaderElement>& elements,std::vector<unsigned int>& colors, unsigned int& maxBits)
{
    std::cout << " Replacing colors with ids...\n";

    unsigned int colorIndex = 0;
    std::unordered_map<unsigned int, unsigned int> colorHash;    // map color to colorID
    for (unsigned int i = 0; i < elements.size();++i){
        try{
            elements[i].RGBA = colorHash.at(elements[i].RGBA);
        } catch(const std::out_of_range& oor){
            colorHash[elements[i].RGBA] = colorIndex;
            elements[i].RGBA = colorIndex;
            colorIndex += 1;
        };
    }

    std::vector<std::pair<unsigned int,unsigned int>> values(colorHash.begin(), colorHash.end());
    auto cmp = [](const std::pair<unsigned int,unsigned int>& l, std::pair<unsigned int,unsigned int>& r) { return l.second < r.second;};
    std::sort(values.begin(),values.end(),cmp);
    for (unsigned int i = 0; i < values.size();++i){
        colors.push_back(values[i].first);
    }

    maxBits = log2(colors.size()) + 1;

    std::cout << " Colors replaced with ids, totalColors:" << colors.size() << ", ColorBits:" << maxBits << "\n";
}

void SVOSaver::saveOpt(const char *output_file, SVO svo)
{
    std::ofstream out;

    out.open(output_file, std::ios::binary | std::ios::out);

    if (!out.is_open())
    {
        std::cout << "Failed to create output file\n";
        return;
    }

    std::vector<ShaderElement> elements = toShaderElements(svo.getRoot());

    std::vector<unsigned int> childPSizeUpdates;
    unsigned int maxChildPBits;
    std::vector<unsigned int> colors;
    unsigned int maxColorBits;

    calcChildPSizeRanges(elements, childPSizeUpdates, maxChildPBits);
    calcColorIds(elements, colors, maxColorBits);

    // write child pointer size update list
    for (unsigned int i = 0; i < childPSizeUpdates.size();++i){
        unsigned int sizeUpdateIndex = _byteswap_ulong(childPSizeUpdates[i]);
        out.write((const char*)&sizeUpdateIndex, 4);
        std::cout << childPSizeUpdates[i] <<  "|";
    }
    // write child pointer size updates list endsymbol
    unsigned int empt = 0;
    out.write((const char*)&empt, 4);  

    // write color size
    const unsigned int colorSize = _byteswap_ulong(maxColorBits);
    const unsigned int totalColors = _byteswap_ulong(colors.size());
    out.write((const char*)&colorSize, 4);   // write color size
    out.write((const char*)&totalColors, 4);   // write total colors
    //write colors
    for (unsigned int color = 0; color < colors.size();++color){
        for (int i = 31; i >= 0;--i){
            writeBit(out, colors[color] & (1 << (i )));
        }
    }

    unsigned int childPointerBits = 1;
    unsigned int p = 0;
    for (unsigned int i = 0; i < elements.size();++i){
        // update child pointer bits
        while (p < childPSizeUpdates.size() && i == childPSizeUpdates[p]){
            childPointerBits += 1;
            p += 1;
        }

        // save element
        saveElement(out, elements[i], childPointerBits, maxColorBits);
    }
    flush(out);

    std::cout << " File size: " << out.tellp() << " bytes\n";

    out.close();
}
void SVOSaver::save(const char *output_file, SVO svo)
{
    std::ofstream out;

    out.open(output_file, std::ios::binary | std::ios::out);

    if (!out.is_open())
    {
        std::cout << "Failed to create output file\n";
        return;
    }

    std::vector<ShaderElement> elements = toShaderElements(svo.getRoot());

    for (unsigned int i = 0; i < elements.size();++i){

        // save element
        saveElement(out, elements[i], 24, 32);
    }
    flush(out);

    std::cout << " File size: " << out.tellp() << " bytes\n";

    out.close();
}

void SVOSaver::flush(std::ofstream &out)
{
    while(writeBufferIndex != 0){
        writeBit(out, 0);
    }
}

void SVOSaver::writeBit(std::ofstream &out, bool bit)
{
    writeBuffer |= (bit << (7-writeBufferIndex));

    writeBufferIndex += 1;
    if (writeBufferIndex >= 8){
        out.write((const char*)&writeBuffer, 1);
        writeBufferIndex = 0;
        writeBuffer = 0;
    }
}

void SVOSaver::saveElement(std::ofstream &out, ShaderElement el, unsigned int childPointerSize, unsigned int colorSize)
{

    for (int i = 7; i >= 0;--i){
        writeBit(out, el.children & (1 << i));
    }

    for (int i = childPointerSize-1; i >= 0;--i){
        writeBit(out, el.childPointer & (1 << (i )));
    }

    for (int i = colorSize-1; i >= 0;--i){
        writeBit(out, el.RGBA & (1 << i));
    }

}