#include "voxelizer.h"
#include "../opengl/shader.h"
#include "../opengl/texture.h"

#include <GL/glew.h>
#include <iostream>
#include <glm/gtc/type_ptr.hpp>

Voxelizer::Voxelizer(int width, int height, int depth, bool fill)
    : _resolution{width, height, depth}, _fill{fill}
{
    _shader = new Shader("shaders/voxelization.vs", "shaders/voxelization.fs", "shaders/voxelization.gs");
    std::cout << " Created shader\n";

    createFramebuffer(width*2, height*2);
    std::cout << " Created framebuffer\n";
    createVoxTexture(width, height, depth);
    std::cout << " Created voxel texture\n";

    if (_fill){
        createNormalTexture(width, height, depth);
        std::cout << " Create normal texture\n";
    }
}

Voxelizer::~Voxelizer()
{
    delete _shader;
    glDeleteTextures(1, &_voxtex);
    glDeleteTextures(1, &_normalTex);

    glDisableVertexAttribArray(1);
    glDisableVertexAttribArray(0);

    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glDeleteBuffers(1, &_vbo);

    glBindVertexArray(0);
    glDeleteVertexArrays(1, &_vao);

    glDeleteFramebuffers(1, &_framebuffer);
    glDeleteTextures(1, &_colorTex);
}

void Voxelizer::createVAO(std::vector<Vertex> vertices)
{
    const size_t VertexSize = sizeof(Vertex);
    const size_t BufferSize = vertices.size() * VertexSize;
    const size_t RgbOffset = sizeof(vertices[0].XYZ);
    const size_t TexCoordOffset = RgbOffset + sizeof(vertices[0].RGBA);
    const size_t normalOffset = TexCoordOffset + sizeof(vertices[0].Texcoord);

    // create array
    glGenVertexArrays(1, &_vao);
    glBindVertexArray(_vao);

    // create buffer
    glGenBuffers(1, &_vbo);
    glBindBuffer(GL_ARRAY_BUFFER, _vbo);
    glBufferData(GL_ARRAY_BUFFER, BufferSize, vertices.data(), GL_STATIC_DRAW);

    // set data pointers
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, VertexSize, 0);
    glVertexAttribPointer(1, 4, GL_FLOAT, GL_FALSE, VertexSize, (GLvoid *)RgbOffset);
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, VertexSize, (GLvoid *)TexCoordOffset);
    glVertexAttribPointer(3, 3, GL_FLOAT, GL_FALSE, VertexSize, (GLvoid *)normalOffset);
    glEnableVertexAttribArray(0);
    glEnableVertexAttribArray(1);
    glEnableVertexAttribArray(2);
    glEnableVertexAttribArray(3);

    glBindBuffer(GL_ARRAY_BUFFER, 0);
}

void Voxelizer::createFramebuffer(int width, int height)
{
    glCreateFramebuffers(1, &_framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, _framebuffer);

    glGenTextures(1, &_colorTex);
    glBindTexture(GL_TEXTURE_2D, _colorTex);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, _colorTex, 0);  

    unsigned int drawBuffers = GL_COLOR_ATTACHMENT0;
    glDrawBuffers(1, &drawBuffers);

    if(glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE){
        throw "Error creating framebuffer";
    }

    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    glBindTexture(GL_TEXTURE_2D, 0);
}

void Voxelizer::createVoxTexture(int width, int height, int depth)
{
    _image.resize(width * height * depth, {0, 0, 0, 0});

    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glActiveTexture(GL_TEXTURE0);
    glGenTextures(1, &_voxtex);
    glBindTexture(GL_TEXTURE_3D, _voxtex);
    glTexStorage3D(GL_TEXTURE_3D, 1, GL_RGBA8, width, height, depth);
    glTexSubImage3D(GL_TEXTURE_3D, 0, 0, 0, 0, width, height, depth, GL_RGBA, GL_UNSIGNED_BYTE, _image.data());
}

void Voxelizer::createNormalTexture(int width, int height, int depth)
{
    _normalImage.resize(width * height * depth, {0, 0, 0, 0});

    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glActiveTexture(GL_TEXTURE0);
    glGenTextures(1, &_normalTex);
    glBindTexture(GL_TEXTURE_3D, _normalTex);
    glTexStorage3D(GL_TEXTURE_3D, 1, GL_RGBA32F, width, height, depth);
    glTexSubImage3D(GL_TEXTURE_3D, 0, 0, 0, 0, width, height, depth, GL_RGBA, GL_FLOAT, _normalImage.data());
}

void Voxelizer::fillImage(glm::mat4 modelMat,std::vector<Vertex> vertices, Texture* tex)
{
    // clear image
    glClearTexSubImage(_voxtex, 0, 0, 0, 0, _resolution[0], _resolution[1], _resolution[2], GL_RGBA, GL_UNSIGNED_BYTE, 0);
    glClearTexSubImage(_normalTex, 0, 0, 0, 0, _resolution[0], _resolution[1], _resolution[2], GL_RGBA, GL_FLOAT, 0);

    // create vertex array object
    createVAO(vertices);

    glBindFramebuffer(GL_FRAMEBUFFER, _framebuffer);
    glDisable(GL_CULL_FACE);
    glDisable(GL_ALPHA_TEST);
    glEnable(GL_MULTISAMPLE);  
    glHint(GL_MULTISAMPLE_FILTER_HINT_NV, GL_NICEST);
    //glEnable(GL_CONSERVATIVE_RASTERIZATION_NV);
    glViewport(0, 0, _resolution[0]*2, _resolution[1]*2);

    glClearColor(0.1f, 0.1f, 0.1f, 0.1f);
    glClear(GL_COLOR_BUFFER_BIT);

    glUseProgram(_shader->program());

    // bind model matrix
    glUniformMatrix4fv(glGetUniformLocation(_shader->program(), "uModel"), 1, false, glm::value_ptr(modelMat));

    // bind texture
    if (tex){
        tex->bind(1);
        glUniform1i(glGetUniformLocation(_shader->program(), "uTex"), 1);
        glUniform1i(glGetUniformLocation(_shader->program(), "uHasTex"), 1);
    } else{
        glUniform1i(glGetUniformLocation(_shader->program(), "uHasTex"), 0);
    }

    // bind vertex array
    glBindVertexArray(_vao);
    glBindBuffer(GL_ARRAY_BUFFER, _vbo);

    // bind output textures
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_3D, _voxtex);
    glBindImageTexture(0, _voxtex, 0, GL_TRUE, 0, GL_READ_WRITE, GL_RGBA8);
    if (_fill){
        glBindTexture(GL_TEXTURE_3D, _normalTex);
        glBindImageTexture(1, _normalTex, 0, GL_TRUE, 0, GL_READ_WRITE, GL_RGBA32F);
    }

    glUniform3iv(glGetUniformLocation(_shader->program(), "uResolution"), 1, _resolution);
    glUniform1i(glGetUniformLocation(_shader->program(), "outTex"), 0);
    glUniform1i(glGetUniformLocation(_shader->program(), "outNormals"), 1);

    std::cout << " Filling texture..." << std::endl;

    glUniform1i(glGetUniformLocation(_shader->program(), "uSwizzle"), 0);
    glDrawArrays(GL_TRIANGLES, 0, vertices.size());
    glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT);
    glUniform1i(glGetUniformLocation(_shader->program(), "uSwizzle"), 1);
    glDrawArrays(GL_TRIANGLES, 0, vertices.size());
    glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT);
    glUniform1i(glGetUniformLocation(_shader->program(), "uSwizzle"), 2);
    glDrawArrays(GL_TRIANGLES, 0, vertices.size());
    glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT);
    glUniform1i(glGetUniformLocation(_shader->program(), "uSwizzle"), 3);
    glDrawArrays(GL_TRIANGLES, 0, vertices.size());


    // wait for drawing to be complete
    glMemoryBarrier(GL_ALL_BARRIER_BITS);

    std::cout << " Texture fill complete\n";

    // fill image width texture data
    std::cout << " Transferring texture data to memory...\n";
    glPixelStorei(GL_PACK_ALIGNMENT, 1);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_3D, _voxtex);
    glGetTexImage(GL_TEXTURE_3D, 0, GL_RGBA, GL_UNSIGNED_BYTE, _image.data());
    if (_fill){
        glBindTexture(GL_TEXTURE_3D, _normalTex);
        glGetTexImage(GL_TEXTURE_3D, 0, GL_RGBA, GL_FLOAT, _normalImage.data());
    }

    // wait for get tex image to be completed
    glMemoryBarrier(GL_ALL_BARRIER_BITS);

    std::cout << " Transfer complete\n";
}

std::vector<Voxel> Voxelizer::voxelize(glm::mat4 modelMat, std::vector<Vertex> vertices, Texture* tex)
{
    fillImage(modelMat, vertices , tex);

    std::cout << " Filling array with voxels from 3D texture...\n";

    std::vector<Voxel> output;

    // add voxels in image to the vector
    for (unsigned int z = 0; z < _resolution[2]; z++)
    {
        for (unsigned int y = 0; y < _resolution[1]; y++)
        {
            Voxel lastvox;  // last added voxel
            bool inside = false;
            unsigned int fillCounter = 0;
            for (unsigned int x = 0; x < _resolution[0]; x++)
            {
                RGBA8 el = getImageElement(x,y,z);
    
                if (el.A > 0)
                {
                    // element found in image, add to voxel output
                    Voxel vox;
                    vox.XYZ[0] = x;
                    vox.XYZ[1] = y;
                    vox.XYZ[2] = z;
                    vox.RGBA.R = el.R;
                    vox.RGBA.G = el.G;
                    vox.RGBA.B = el.B;
                    vox.RGBA.A = el.A;
                    output.push_back(vox);

                    if (_fill){
                        XYZW32F normal = getNormalImageElement(x,y,z);
                        if (normal.X < 0){
                            // found a wall, now inside the mesh
                            if (inside){
                                // no closing wall, remove added voxels
                                output.resize(output.size() - fillCounter);
                            }
                            inside = true;
                            fillCounter = 0;
                        } else if (normal.X > 0){
                            // found a closing wall, no longer inside mesh
                            inside = false;
                        }
                    }

                    lastvox = vox;
                } 
                else if (_fill && inside){
                    fillCounter += 1;
                    lastvox.XYZ[0] = x;
                    lastvox.XYZ[1] = y;
                    lastvox.XYZ[2] = z;
                    output.push_back(lastvox);
                }
            }
            if (_fill && inside){
                // no closing wall, remove added voxels
                output.resize(output.size() - fillCounter);
            }
        }
    }

    std::cout << " Array filled\n";

    return output;
}

unsigned int Voxelizer::imageIndex(unsigned int x, unsigned int y, unsigned int z)
{
    return z * _resolution[1] * _resolution[0] + y * _resolution[0] + x;
}

RGBA8 Voxelizer::getImageElement(unsigned int x, unsigned int y, unsigned int z)
{
    return _image[imageIndex(x,y,z)];
}

Voxelizer::XYZW32F Voxelizer::getNormalImageElement(unsigned int x, unsigned int y, unsigned int z)
{
    return _normalImage[imageIndex(x,y,z)];
}

void Voxelizer::voxelizeSave(std::ofstream &out, glm::mat4 modelMat,std::vector<Vertex> vertices, Texture* tex)
{
    fillImage(modelMat, vertices , tex);

    std::cout << " Saving voxels to file in z-order\n";

    for (uint64_t pos = 0; pos < _resolution[0]*_resolution[1]*_resolution[2];++pos){
        // get the voxel in z-order
        unsigned int x = 0;
        for (unsigned int i = 0; i < 22;++i){
            x |= ((pos & ((uint64_t)1 << i*3)) > 0) << i; 
        }
        unsigned int y = 0;
        for (unsigned int i = 0; i < 21;++i){
            y |= ((pos & ((uint64_t)1 << i*3 + 1)) > 0) << i; 
        }
        unsigned int z = 0;
        for (unsigned int i = 0; i < 21;++i){
            z |= ((pos & ((uint64_t)1 << i*3 + 2)) > 0) << i; 
        }

        RGBA8 el = getImageElement(x,y,z);
        out.write((char*)&el.R, 1);
        out.write((char*)&el.G, 1);
        out.write((char*)&el.B, 1);
        out.write((char*)&el.A, 1);
    }


    std::cout << " Voxels saved filled\n";
}

std::vector<RGBA8> Voxelizer::voxelizeMap(glm::mat4 modelMat,std::vector<Vertex> vertices, Texture* tex)
{
    fillImage(modelMat, vertices , tex);

    return _image;
}