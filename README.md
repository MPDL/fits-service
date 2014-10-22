fits-service
============

### Intro

REST web Service to visualize fits format data, via [http://js9.si.edu/](js9)

### Installation

1. Install Maven [download](http://maven.apache.org/download.cgi)
2. Install Tomcat [download](http://maven.apache.org/download.cgi)
3. `git clone https://github.com/MPDL/fits-service`
5. Compile the service: go into `fits-service directory`, run `mvn clean install`
6. Copy `fits.war` in Tomcat `webapp` directory
7. Create file `fits-service.properties`, add following property in it
```
service.url = url_of_the _service
```
 and put the file into Tomcat `conf` directory

8. Start Tomcat
9. Service runs under `url_of_the _service/fits`

### Usage

Following REST commands are implemented(You can check `http://localhost:8080/swc/api/explain` page for swc-service usage examples):
 

##### **Path**: /api/view
- **Method**: POST
- **Media type**: multipart/form-data
- **Input fields**: 
  - field 1:
    - **name**: file1
    - **type**: file
    - **value**: locally selected fits file
- **Response**:
Delivers HTML view representation of the fits file. 

##### **Path**: /api/view
- **Method**: GET
- **Media type**: application/x-www-form-urlencoded
- **Input fields**: 
  - field 1:
    - **name**: url
    - **type**: text
    - **value**: link to the fits URL
  - field 2:
    - **name**: load
    - **type**: text
    - **value**: true|flase
- **Response**:
returns HTML view representation of the fits file referenced by the URL. 

 
### Notes
 
Because of Same-Origin Policy restrict, we use [http://www.w3.org/TR/cors/](Cross-Origin Resource Sharing) as the solution.
The response header must contains **Access-Control-Allow-Origin: * ** to make sure any other services which belongs to other domians can access out fit service. So the first layer service container(Tomcat or Apache) must response with such a header.

- If you use **apache** as the fist service layer, you can enable it in apache configuation, check it [http://enable-cors.org/server_apache.html](here)
- If you use **tomcat**, nothing more is needed to be done because fits handles the header.
