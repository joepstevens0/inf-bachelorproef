#include "texture.h"
#include <iostream>
#include <GL/glew.h>

#define STB_IMAGE_IMPLEMENTATION
#include <stb_image.h>

Texture::Texture(const char* texturePath)
{
    std::cout << " Loading texture: " << texturePath << "\n";
    glGenTextures(1, &_tex);
    glBindTexture(GL_TEXTURE_2D, _tex);

    int width, height, nrChannels;
    stbi_set_flip_vertically_on_load(true);  
    uint8_t *data = stbi_load(texturePath, &width, &height, &nrChannels, 0); 

    if (data){  
        if (nrChannels > 3){
            glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);
        } else{
            glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
        }
        glGenerateMipmap(GL_TEXTURE_2D);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        stbi_image_free(data);
        std::cout << " Succesfully loaded texture\n";
    } else{
        std::cout << "Failed to load texture\n";
    }
}

Texture::~Texture()
{   
    glDeleteTextures(1, &_tex);
}

void Texture::bind(unsigned int slot)
{
    glActiveTexture(GL_TEXTURE0 + slot);
    glBindTexture(GL_TEXTURE_2D, _tex);
}