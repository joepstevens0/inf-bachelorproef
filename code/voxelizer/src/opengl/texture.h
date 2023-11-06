#ifndef TEXTURE_H
#define TEXTURE_H

class Texture
{
public:
    Texture(const char* texturePath);
    ~Texture();

    void bind(unsigned int slot);
private:
    unsigned int _tex = 0;
};

#endif