var fs = require('fs')
var path = require('path')

/**
 * 遍历文件夹以及文件
 * @type {{}}
 */
exports.walk = function() {
    function collect(opts, el, prop) {
        if ((typeof opts.filter == "function") ? opts.filter(el) : true) {
            opts[prop].push(el);
            if (opts.one === true) {
                opts.filter = function() {
                    return false;
                };
                opts.count = 0;
            }
        }
    }
    function sync(p, opts) {
        try {
            var stat = fs.statSync(p);
            var prop = stat.isDirectory() ? "dirs": "files";
            collect(opts, p, prop);
            if (prop === "dirs") {
                var array = fs.readdirSync(p);
                for (var i = 0, n = array.length; i < n; i++) {
                    sync(path.join(p, array[i]), opts);
                }
            }
        } catch(e) {}
    };
    function async(p, opts) {
        opts.count++;
        fs.stat(p, function(e, s) {
            opts.count--;
            if (!e) {
                if (s.isDirectory()) {
                    collect(opts, p, "dirs");
                    opts.count++;
                    fs.readdir(p, function(e, array) {
                        opts.count--;
                        for (var i = 0, n = array.length; i < n; i++) {
                            async(path.join(p, array[i]), opts);
                        }
                        if (opts.count === 0) {
                            opts.cb(opts.files, opts.dirs);
                        }
                    });
                } else {
                    collect(opts, p, "files");
                }
                if (opts.count === 0) {
                    opts.cb(opts.files, opts.dirs);
                }
            }
            if (e && e.code === "ENOENT") {
                opts.cb(opts.files, opts.dirs);
            }
        });
    };
    return function(p, cb, opts) {
        if (typeof cb == "object") {
            opts = cb;
            cb = opts.cb;
        }
        opts = opts || {};
        opts.files = [];
        opts.dirs = [];
        opts.cb = typeof cb === "function" ? cb: function(){};
        opts.count = 0;
        if (opts.sync) {
            sync(path.normalize(p), opts);
            opts.cb(opts.files, opts.dirs);
        } else {
            async(path.normalize(p), opts);
        }
    };
}();
/**
 * 文件读取
 * @param file
 * @param success
 */
exports.readFile = function(file){
    return fs.readFileSync(file, defConf.encode);
}
/**
 * 文件写入
 * @param file
 * @param text
 */
exports.writeFile = function(file, text){
    fs.open(file, "w", 0666, function(e, fd){
        if(e) throw e;
        fs.write(fd, text, 0, defConf.encode, function(e){
            if(e) throw e;
            fs.closeSync(fd);
        });
    });
}
/**
 * 获取父级文件夹
 * @param filePath
 * @returns {*}
 */
exports.getParentDir = function(filePath){
    filePath = path.resolve(filePath);
    var dirname = path.dirname(filePath);
    var dirArr = dirname.split(/\\/);
    return dirArr.pop();
}

/**
 * 是否抛弃当前文件夹
 * @param file
 * @returns {boolean}
 */
exports.isDirIgnore = function(file){
    var dir = getParentDir(file)
    return defConf.ignore.indexOf(dir) != -1
}
/**
 * 单个css文件解析
 * @param cssfile
 */
function oneCssBuild(cssfile){
    var code = readFile(cssfile);
    var cssCode = cssParse(code);
    writeFile(cssfile, cssCode);
}
//设置lessc路径
var lessc = path.resolve('./node_modules/.bin/lessc.cmd');
/**
 * less文件编译
 * @param filename
 */
var lessCount;
var lessCompire = function(filename, fn) {
    var dir = getParentDir(filename)
    var lessDir = defConf.workspace + defConf.input + '/' + dir;

    var baseName = path.resolve(lessDir, path.basename(filename, '.less')) + '.css';

    //运行lessc命令
    exec('' + lessc + ' ' + filename + ' ' + baseName, { encoding: defConf.encode},
        function (err, stdout, stderr) {
            if (err != null) {
                console.log(err)
            }
            oneCssBuild(baseName);
            lessCount--;
            console.log('剩余：' +lessCount);
            if(!lessCount){
                fn && fn();
            }
        }
    );
};

function lessBuild(fn){
    var lessPath = defConf.workspace + defConf.lessInput;
    function build(files){
        lessCount = files.length;
        files.forEach(function(file){
            lessCompire(file, fn);
        });
    }
    walk(lessPath, build);
}

var TIMES;
/**
 * 计时
 */
function onStart(){
    TIMES = +new Date;
    console.log('>>Start build');
}

function onEnd(){
    var timeUse = +new Date - TIMES;
    console.log('>>All done: Time use:', timeUse/1000, '秒');
    console.log('完成时间:', Date());
}
/**
 * 多个 css 构建
 */

function cssBuild(){
    var cssPath = defConf.workspace + defConf.input;
     function build(files){
         files.forEach(function(file){
             if(isDirIgnore(file)) return;
             oneCssBuild(file);
         });
     }
    walk(cssPath, build);
}
/**
 * 开始执行
 */
(function(){
    onStart();
    lessBuild(onEnd);
//    cssBuild();
})()