
#include <string.h>
#include <GL/glew.h>
#include <GL/freeglut.h>
#include <iostream>
#include <vector>
#include <string>
#include <glm/gtc/matrix_transform.hpp>

#include "voxelizer/SVOMaker.h"
#include "window.h"
#include "voxelizer/SVOSaver.h"

Window* window;
SVOMaker* SVOmaker;

const char *WINDOW_TITLE = "Window title";


void initGL()
{
    GLenum GlewInitResult;
    glewExperimental = GL_TRUE;
    GlewInitResult = glewInit();

    if (GLEW_OK != GlewInitResult)
    {
        std::cerr << "ERROR: " << glewGetErrorString(GlewInitResult) << "\n";
        exit(EXIT_FAILURE);
    }

    std::cerr << "INFO: OpenGL Version: " << glGetString(GL_VERSION) << "\n";
}

void saveSVOfromModel(const char* output_file, ModelLoader::Result model, glm::vec3 offset, glm::vec3 size, unsigned int depth, bool optimize)
{
    std::cout << "Creating SVO's from " << model.models.size() << " models\n";
    SVO svo = SVOmaker->modelToSvo(offset, size,model.models[0], depth);
    for (unsigned int i = 1; i < model.models.size(); ++i){
        SVO s = SVOmaker->modelToSvo(offset, size,model.models[i], depth);
        svo.addSVO(s);
    }

    // save svo to file
    std::cout << "Saving SVO to file " << output_file << "...\n";
    if (optimize){
        SVOSaver::saveOpt(output_file,svo);
    }else{
        SVOSaver::save(output_file,svo);
    }
    std::cout << "SVO saved to file\n";
}

void splitsave(const char* output_file, ModelLoader::Result model, glm::vec3 offset, glm::vec3 size, unsigned int depth, bool optimize)
{
    if (depth >= 12){
        size = size * glm::vec3(2,2,2);
        offset = offset * glm::vec3(2,2,2);
        for (uint8_t i = 0; i < 8;++i){
            float d = -1;
            glm::vec3 coffset = offset + glm::vec3(((i&1) > 0)*d,((i&2) > 0)*d,((i&4) > 0)*d);
        
            splitsave((std::to_string(i) + output_file).c_str(), model, coffset, size, depth-1, optimize);
        }
    } else{
        saveSVOfromModel(output_file, model, offset, size, depth, optimize);
    }
}


int main(int argc, char *argv[])
{
    if (argc< 5){
        std::cout << "Usage: ./main <inputpath> <inputfilename> <depth> <outputfile> <opt = 0> <fill = 0>";
        return 1;
    }
    const char* input_path = argv[1];
    const char* input_file_name = argv[2];
    const unsigned int depth = std::stoi(argv[3]);
    const char* output_file = argv[4];
    bool optimize = false;
    if (argc > 5){
        optimize = (bool)std::stoi(argv[5]);
    }
    bool fill = false;
    if (argc > 6){
        fill = (bool)std::stoi(argv[6]);
    }
    const unsigned int resolution = 1 << depth;             // res = pow(2,depth)

    // create window
    window = new Window(WINDOW_TITLE, 1, 1);
    initGL();

    // create SVOMaker
    SVOmaker = new SVOMaker(resolution, fill);

    // load model
    std::cout << "Loading model...\n";
    ModelLoader::Result model = ModelLoader::loadModel(input_path, input_file_name);
    std::cout << "Model loaded\n";
    
    if (model.models.size() <= 0){
        std::cerr << "Error loading model\n";
        return -1;
    }

    glm::vec3 offset(0,0,0);
    glm::vec3 size(1,1,1);
    // splitsave(output_file, model, offset, size, depth, optimize);

    std::ofstream out(output_file, std::ios_base::binary);
    SVOmaker->modelToSvoFile(out, offset, size, model.models[0], depth);

    delete SVOmaker;
    delete window;

    return 0;
}