## Setup and usage
To start the front-end, go to the front-end dir and execute `npm install` and `npm start`. The back-end will start on http://localhost:8080.
In the front-end dir "src" can a file `constants.ts` be found with interesting values that can be changed.

To start the back-end, go to the back-end dir and execute `npm install` and `npm start`. The back-end will start on http://localhost:5001.
In the back-end interesting values can be found in the file `constants.ts` in the dir "src". The used SVO files can be found in de directory `assets/SVOfiles`.

To use the voxelizer, an executable was generated with a GNU c++ compiler and the following args: 
`g++.exe -g ${workspaceFolder}/src/*.cpp ${workspaceFolder}/src/opengl/*.cpp ${workspaceFolder}/src/voxelizer/*.cpp -o ${workspaceFolder}/main.exe -I${workspaceFolder}/include -L${workspaceFolder}/libs -lfreeglutd -lgdi32 -lopengl32 -lglew32 -static`.
The executable uses the followings arguments: `inputpath inputfilename depth outputfile opt fill`. 
* inputpath is the directory of the model where a .obj model and its material files can be found. 
* inputfilename is the filename of the .obj file.
* depth is the depth of the resulting SVO.
* outputfile is the filename and path of the resulting SVO.
* opt is optional and by default 0, a 1 causes an more optimized version of an SVO.
* fill is optional and by default 0, a 1 uses a work in progress fill algorithm to try to fill the SVO.