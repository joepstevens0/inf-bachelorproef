#ifndef WINDOW_H
#define WINDOW_h

class Window
{
public:
    Window(const char* title, int width, int height);
    ~Window();
private:

    void init(const char* title, int width, int height);

    void reshape(int w, int h);
    void timer(int Value);

    int _windowHandle = 0;

};

#endif