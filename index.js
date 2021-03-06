var fs = require('fs')
var path = require('path')
/**
 * 合并对象
 * @type {{}}
 */
exports.mix = function(receiver, supplier){
    var args = Array.apply([], arguments),
        i = 1,
        key,
        ride = typeof args[args.length - 1] == "boolean" ? args.pop() : true;

    if(args.length == 1){
        receiver = ! this.window ? this: {};
        i = 0;
    }   

    while ((supplier = args[i])) {
        i++;
        for (key in supplier) { //允许对象糅杂，用户保证都是对象
            if (supplier.hasOwnProperty(key) && (ride || ! (key in receiver))) {
                receiver[key] = supplier[key];
            }
        }
    }
    return receiver;
}

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
//创建目录,如果指定路径中有许多中间的目录不存在,也一并创建它们
/*
参数
p为一个目录的路径，以“/”隔开
 */
var mkdirSync = exports.mkdirSync = function(p) {
    p = path.normalize(p);
    var array = p.split(path.sep); //创建目录,没有则补上
    for (var i = 0, cur; i < array.length; i++) {
        if (i === 0) {
            cur = array[i];
        } else {
            cur += (path.sep + array[i]);
        }
        try {
            fs.mkdirSync(cur, "0755");
        } catch(e) {}
    }
}
/**
 * 文件读取
 * @param file
 * @param success
 */
var readFile = exports.readFile = function(file){
    return fs.readFileSync(file, defConf.encode);
}
var readFileSync = exports.readFileSync = function() {
    // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
    // because the buffer-to-string conversion in `fs.readFileSync()`
    // translates it to FEFF, the UTF-16 BOM.
    var content = fs.readFileSync.apply(fs, arguments).toString();
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    return content;
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
//目录对拷,可以跨分区拷贝
/*
参数
old为一个目录的路径，String,以“/”隔开
neo为一个目录的路径，String,以“/”隔开
cb 可选，回调    
 */
exports.cpdirSync = function(old, neo, cb) {
    function inner(old, neo) {
        var array = fs.readdirSync(old);
        for (var i = 0, n = array.length; i < n; i++) {
            var source = array[i];
            var source = path.join(old, source.replace(old, ""));
            var target = path.join(neo, source.replace(old, ""));

            var stat = fs.statSync(source); //判定旧的IO对象的属性，是目录还是文件或是快捷方式
            if (stat.isDirectory()) {
                inner(source, target);
            } else if (stat.isSymbolicLink()) {
                fs.symlinkSync(fs.readlinkSync(source), target);
            } else {
                fs.writeFileSync(target, readFileSync(source));
            }
        }
    }
    return function(old, neo, cb) { //把当前目录里面的东西拷贝到新目录下（不存在就创建）
        old = path.resolve(process.cwd(), old);
        neo = path.resolve(process.cwd(), neo); //允许拷贝到另一个分区中
        if (!fs.existsSync(neo)) { //创建新文件
            mkdirSync(neo);
        }
        inner(old, neo);
        if (typeof cb == "function") {
            cb();
        }
    };
}()
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
