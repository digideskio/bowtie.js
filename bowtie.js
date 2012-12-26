/*
 * bowtie.js
 *
 * REQUIRES JQUERY
 *
 * A class which allows developers to quickly upload and use template files as if they were views via the front-end.
 * This system is best for one-page web applications with heavy js implementation.
 *
 * Accidentally created this whole system before knowing about Mustache.js, which is almost the exact same thing.
 * However, this code implements syntax for logic stuff: for, if, else, get, include, etc... while mustache is "logicless" (so it claims).
 *
 * Geoff Daigle - 2012
 *
 */

bowtie = {

    // this is where all of the template markup will be stored
    data: {},

    // this is the pointer to the full database object to handle includes
    databaseref: {},

    // Load any widget from a URL which can pass this functioin an HTML DOM or a JSON object.
    // Widgets are loaded from URLs via ajax as opposed to passing a raw string for more familar MVC organization of individual view files.
    load: function($key, $url, $callback, $isjson, $type) {
        var bJSON = $isjson || false,
            type = $type || '';

        // if json is passed, IGNORE $key and use one set in the json data
        if (bJSON) {
          $.ajax({
                type: "POST",
                url: $url,
                data: "",
                success: function(data){
                    bowtie.data = $.parseJSON(data);
                    $callback.call(this);
                },
                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    // if the connection or loading fails:
                    // pull locally stored widgets if localstorage is defined

                    // THIS IS AN EXAMPLE
                    /*if (mylocalstorage !== undefined)
                    {
                        bowtie.data = $.parseJSON(mylocalstorage.templates);
                        $callback.call(this);
                    }
                    else
                    {
                        //else, total fail
                        console.error('ERROR (bowtie.load): There was an error loading the template files, and there is no local backeup defined.');
                    }*/
                }
            });
        }
        else 
        {
            key = $key.split(':');
            namespace = key[0];
            widget = key[1];
            $.ajax({
                type: "POST",
                url: $url,
                data: "",
                success: function(data){
                    // populate the data object
                    if (bowtie.data[namespace] === undefined) {
                        bowtie.data[namespace] = {};
                    }
                    bowtie.data[namespace][widget] = data;
                    $callback.call(this);
                },
                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    //total fail (we assume since this is a single upload, there is no backup)
                    console.error('ERROR (bowtie.load): There was an error loading the template files from '+$url+'.');
                }
            });
        }

    },

    // This runs the logic which takes a dataset and inserts it into the markup.
    // $key is always in the form of 'namespace:widget' and $values is an object of properties named after the replacement vars
    populate: function($key, $values){
        if (typeof $key === 'string') {
            var widgetobj = bowtie.fetch($key);
        } else if (typeof $key === 'object') {
            var widgetobj = $key.html;
        } else {
            console.error('ERROR: bowtie.populate: param $key is not a string or an object');
            return false;
        }

        var globals = $values;

        // collect all template html that might be referenced inside this template
        widgetobj = bowtie.templateShepherd(widgetobj); 

        // take other, external data and merge it with this "values" object
        globals = bowtie.includeSauce(widgetobj, globals);

        // create a separate block instance for any blocks surrounded by {{#}} {{/#}} 
        // population is carried out separately here
        widgetobj = bowtie.antisocialPopulate(widgetobj, globals);

        // satisfy any get: commands
        globals = bowtie.scopetron(widgetobj, globals);

        // do loop statements
        widgetobj = bowtie.blockchunker(widgetobj, globals, 'loop');

        // do non-loop if-statements
        widgetobj = bowtie.blockchunker(widgetobj, globals, 'if');

        // populate regular variables and/or do some basic string manipulation
        widgetobj = bowtie.variablizer(widgetobj, globals);

        // get rid of the extra {{}}
        widgetobj = bowtie.sweeper(widgetobj);

        return widgetobj;
    },

    // get raw widget html and return it (simply shorthand for passing no data to bowtie.populate)
    get: function(key) {
        return bowtie.populate(key, {});
    },



    // internally-used function which returns a template's unmodified markup by parsing the key
    fetch: function(key){
        key = key.split(':');
        namespace = key[0];
        widget = key[1];
        var widgetobj = bowtie.data[namespace];
        if (widgetobj === undefined) return null;
        widgetobj = widgetobj[widget];
        if (widgetobj === undefined) return null;
        return widgetobj;
    },



    /* 
     *  Template script parsing logic
     *  (Supports concatinating templates, echoing variables, if-true/if-not-true/elseif/else statements, and nested for-in / if statements)
     */
	

    // SWEEPER
    // a simple cleanup script to remove extra {{}}'s
    sweeper: function(widgetobj){
        var templatesniff = widgetobj.match(/\{\{(.*?)\}\}/g),
            tempmatchlen, i;
        if (templatesniff != null)
        {
            tempmatchlen = templatesniff.length;
            for (i = 0; i < tempmatchlen; i = i + 1) {
                widgetobj = widgetobj.replace(templatesniff[i], '');
            }
        }
        return widgetobj;
    },


    // ANTISOCIALPOPULATE
    // Takes chunks of the script surrounded by {{#}} {{/#}} and runs the population from the beginning as a separate instance
    // This is useful when dealing with incompatable sets of data 
    antisocialPopulate: function(widgetobj, globals){
        var templatesniff = widgetobj.match(/\{\{[\s]{0,100}\#[\s]{0,100}\}\}(.|\n)*\{\{[\s]{0,100}\/\#[\s]{0,100}\}\}/g),
            tempmatchlen, i, cutout, newvars;
        if (templatesniff != null)
        {
            tempmatchlen = templatesniff.length;
            for (i = 0; i < tempmatchlen; i = i + 1) {
                cutout = templatesniff[i].replace(/\{\{[\s]{0,100}\#[\s]{0,100}\}\}/, '').replace(/\{\{[\s]{0,100}\/\#[\s]{0,100}\}\}/, '');
                newvars = $.extend({}, globals);
                widgetobj = widgetobj.replace(templatesniff[i], bowtie.populate({html:cutout}, newvars));
            }
        }
        return widgetobj;
    },


    // VARIABLIZER
    // Besides doing a simple variable-replace by matching the var name that is found in {{ }}, there are some other functions available:
    // - %: this is a comment
    // - time2human (TODO): this is a quick format from YYYY-MM-DD HH:MM:SS to something like "25 Jan 2012"
    // - time2relative (TODO): turns YYYY-MM-DD HH:MM:SS into something like "17 min ago" (going to gut timeago.js for some help with that)
    // - trim: if the string is larger than the number specified, the string will be truncated to that length and "..." will be added to the end
    // More to come.... 
    variablizer: function(widgetobj, values){
        var varsniff = widgetobj.match(/\{\{[\s]{0,100}(.*?)[\s]{0,100}\}\}/g);
        if (varsniff != null)
        {
            var varlen = varsniff.length;
            for (var i = 0; i < varlen; i = i + 1) {
                var variable = varsniff[i].replace(/\{\{|\}\}|\s/g, '');
                // this is a comment
                if(variable.indexOf('%') === 0) {
                    // skip
                }
                // this converts a timestamp string into a string like "25 Oct 2012"
                else if(variable.indexOf('time2human') === 0 || variable.indexOf('time2short') === 0) {
                    var firstSplit = variable.indexOf(':');
                    variable = variable.substr(firstSplit+1, variable.length);
                    var timestamp = ($.trim(values[variable])).split(' ')[0];
                    timestamp = timestamp.split('-');

                    if (variable.indexOf('time2human') === 0) {
                        var months = [
                            "January", "February", "March", "April", "May", "June",
                            "July", "August", "September", "October", "November", "December"
                        ];
                    } else {
                        var months = [
                            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
                        ];
                    }
                    var day = timestamp[2].replace(/^0/, ''); 

                    var insertstr = day+' '+months[parseInt(timestamp[1])-1]+' '+timestamp[0];
                    if (timestamp[0] === '0000') insertstr = "N/A";

                    widgetobj = widgetobj.replace(varsniff[i], insertstr);
                }
                // this converts a timestamp string to a relative string like "5 min ago"
                else if(variable.indexOf('time2relative') === 0) {
                    // uses 3rd party plugins for now
                }
                // this converts a string into it's slug equivelent ("Hello world!" -> "hello-world")
                else if(variable.indexOf('slug:') === 0) {
                    variable = $.trim(variable.replace('slug:', ''));
                    variable = $.trim(values[variable]).slugify();
                    widgetobj = widgetobj.replace(varsniff[i], variable);
                }
                // this is a trim command
                else if (variable.indexOf('trim(') === 0) {

                    var trimamount =  variable.match(/\(([0-9]{1,100})\)/g);
                    if (trimamount != null)
                    {
                        trimamount = trimamount[0].replace(/\(|\)/g, '');
                        trimamount = parseInt(trimamount);

                        var trimvar = variable.replace(/trim\((.*?)\):/g, '');
                        if (values[trimvar] !== undefined)
                        {
                            var addon = '...';
                            if (values[trimvar].length < trimamount-3) addon = '';

                            var insertvar = values[trimvar].substr(0, trimamount) + addon;
                            widgetobj = widgetobj.replace(varsniff[i], insertvar);
                        }
                    }   
   
                }
                // this is a regular variable
                else
                {
                    if (values[variable] !== undefined)
                    {
                        widgetobj = widgetobj.replace(varsniff[i], values[variable]);
                    }
                }
            }
        }

        return widgetobj;
    },


    // INCLUDESAUCE
    // Looks for calls to include other data sets in the population object.
    // SYNTAX: {{ include: VAR.PROP.PROP.etc as ALIAS }}
    // You can also simply include 'variable' without properties as well
    includeSauce: function(widgetobj, dataobj){
        var used_data = [], insdataset = {},
            templatesniff = widgetobj.match(/\{\{[\s]{0,100}include:(.*?)[\s]{0,100}as[\s]{0,100}(.*?)[\s]{0,100}\}\}/g),
            tempmatchlen, i, dataset, includekey, includekeyfull, alias, inclen, k,
            dataset2, insertobj;

        if (templatesniff != null)
        {
            tempmatchlen = templatesniff.length;
            for (i = 0; i < tempmatchlen; i = i + 1) {
                dataset = {};
                includekey = templatesniff[i].replace(/\{\{|include|\:|\}\}/g, '').replace(/^\s+|\s+$/g, '').replace(/[\s]{1,100}/g, ' ');
                includekeyfull = includekey.split(' as ');
                alias = includekeyfull[1];
                includekey = includekeyfull[0].split('.');
                inclen = includekey.length;
                for (k = 0; k < inclen; k = k + 1) {
                    if (k === 0)
                    {
                        if (bowtie.databaseref[includekey[k]] !== undefined) {
                            dataset = bowtie.databaseref[includekey[k]];
                        }
                        else
                        {
                            console.error('ERROR includeSauce: "'+includekey[k]+'" is not defined in bowtie.databaseref');
                            break;
                        }
                    }
                    else
                    {
                        if (dataset[includekey[k]] !== undefined) {
                            dataset2 = $.extend({}, dataset[includekey[k]]);
                            dataset = null;
                            dataset = {};
                            dataset = dataset2;
                        }
                        else
                        {
                            console.error('ERROR includeSauce: "'+includekey[k]+'" is not defined in bowtie.databaseref');
                            break;
                        }
                    }
                }
                if ($.inArray(alias, used_data) === -1) {
                    insertobj = {};
                    insertobj[alias] = dataset;
                    insdataset = $.extend(insdataset, insertobj);
                    used_data[used_data.length] = alias;
                }
            }
        }
        dataobj = $.extend(dataobj, insdataset);

        return dataobj;
    },


    // TEMPLATESHEPHERD
    // Looks for other template calls inside of this template markup and merge them.
    // Called by  {{template: key}} where key is in the form of namespace:name
    templateShepherd: function(widgetobj){
        var templatesniff = widgetobj.match(/\{\{[\s]{0,100}template:(.*?)[^\s]:[^\s](.*?)[\s]{0,100}\}\}/g),
            tempmatchlen, i, templatekey, templatehtml;

        if (templatesniff != null)
        {
            tempmatchlen = templatesniff.length;
            for (i = 0; i < tempmatchlen; i = i + 1) {
                templatekey = templatesniff[i].replace(/\{\{|template|\s|\}\}/g, '').replace(/^:/g, '');
                templatehtml = bowtie.fetch(templatekey);
                if (templatehtml !== null)
                {
                    widgetobj = widgetobj.replace(templatesniff[i], bowtie.templateShepherd(templatehtml));
                }
                else
                {
                    widgetobj = widgetobj.replace(templatesniff[i], '');
                }

            }
        }
        return widgetobj;
    },


    // SCOPETRON
    // When {{get:VAR}} is called, this does a var.value == var2[propname] compare and places the var2[propname] object into the global scope if true
    // This is really helpful when you want to do somehing like "while looping, use the candidate[index] where index equals the current user_id"
    // This function is often used in conjunction with {{include:VAR as ALIAS}} for some quick data joining
    //
    // Another function done here is variable assigmnent for on-the-fly manual changes
    // Simply parses the string {{ VAR = VALUE }} and assigns (or creates) the object property with a string value of VALUE
    // NOTE: Variable translation happens far after all of the variable assigmnent has been completed, so if you assign a
    //       value to a global variable at the bottom of the template, a call to it at the top will yield the new value.
    scopetron: function(widgetobj, values){
        var varsniff = widgetobj.match(/\{\{[\s]{0,100}get:(.*?)[\s]{0,100}\}\}|\{\{[\s]{0,100}(.*?)=(.*?)[\s]{0,100}\}\}/g),
            varlen, i, variable, getvar, selector, index, innersel,
            varkey, varval;

        if (varsniff != null)
        {
            varlen = varsniff.length;
            for (i = 0; i < varlen; i = i + 1) {
                variable = varsniff[i].replace(/\{\{|\}\}|\s/g, '');
                if (variable.indexOf('=') !== -1) {
                    // we have variable assignment
                    variable = variable.split('=');
                    varkey = $.trim(variable[0]);
                    varval = $.trim(variable[1]);
                    // assign the variable
                    values[varkey] = varval;
                } else {
                    // this is a get command
                    getvar = variable.replace('get:', '');
                    getvar = getvar.split('[');
                    // only continue if correctly formatted
                    if (getvar.length > 1)
                    {
                        selector = getvar[0];
                        index = getvar[1].replace(']', '');
                        innersel = values[selector];
                        if(innersel !== undefined) {
                            //alert(index+' = '+values[index]);
                            // only continue if this index and variable exist
                            if (innersel[values[index]] !== undefined)
                            {
                                values = $.extend(values, innersel[values[index]]);
                            }
                        }
                    }
                }
            }
        }

        return values;
    },


    // BLOCKCHUNKER
    // if-equal / if-not-equal evaluation OR loop statements
    // Can be for both if statements and looping because this simply chunks out the data based on start and end tags
    // The callback for either loop eval or logic eval is based on the value of $loopOrLogic
    blockchunker: function($rawtemplate, $data, $loopOrLogic) {
            // we're saving the original string for chunking out parts via index
        var origtemplate = $rawtemplate,
            // this is the part we are going to return
            evalTemplate = $rawtemplate,
            // and the rest...
            repmatch, snippets = [], startblock = 0, lastindex = 0,
            numBlocks, i, rval, blocklen, evalblock,
            searchregex, starttag, endtag, newdata;

        if ($loopOrLogic == 'loop')
        {
            searchregex = /\{\{[\s]{0,100}loop\:(.*?)[\s]{0,100}\}\}|\{\{[\s]{0,100}endloop[\s]{0,100}\}\}/g;
            starttag = 'loop';
            endtag = 'endloop';
        }
        else
        {
            searchregex = /\{\{[\s]{0,100}if(.*?)[\s]{0,100}\}\}|\{\{[\s]{0,100}endif[\s]{0,100}\}\}/g;
            starttag = 'if';
            endtag = 'endif';
        }

        // get all start and end snippets so we can separate the chunks out and evaluate
        while (repmatch = searchregex.exec(origtemplate)) {
            snippets.push({ value: repmatch[0], index: repmatch.index, endindex: repmatch.index + repmatch[0].length });
        }

        // walk through each and pull/evaluate chunks
        // keep track of the block types so we can accurately pop out the top-tier chunks 
        numBlocks = snippets.length;
        for (i = 0; i < numBlocks; i++) {

            // we need an unmodified dataset for proper variable eval within loop tiers, so we'll copy it over here
            if ($loopOrLogic == 'loop') 
            {
                newdata = {};
                $.extend(newdata,$data);
            }

            // trim the string and take note of the start/end indexes
            rval = snippets[i].value.replace('{{', '').replace('}}', '').replace(/^\s+|\s+$/g,"");
            if (rval.indexOf(starttag) === 0)
            {
                if (startblock == 0)
                {
                    lastindex = snippets[i].index;
                }
                startblock = startblock + 1;
            }
            if (rval.indexOf(endtag) === 0)
            {
                startblock = startblock - 1;
                // if startblock is zero, we hit the end of a top-tier block
                if (startblock == 0)
                {
                    // cut out the chunk
                    blocklen = snippets[i].endindex - lastindex;
                    evalblock = origtemplate.substr(lastindex, blocklen);

                    // evaluate chunk and glue it in to the return string
                    if ($loopOrLogic == 'loop') 
                    {
                        evalTemplate = evalTemplate.replace(evalblock, bowtie.loopTokenize(evalblock, newdata));
                    }
                    else
                    {
                       evalTemplate = evalTemplate.replace(evalblock, bowtie.logicEval(evalblock, $data));
                    }
                }
            }
        }

        return evalTemplate;
    },

    // LOGICEVAL
    // Do the logic for full if, ifelse, else statements and loop with logicifier for nesting situations
    // [this is called inside of BLOCKCHUNKER and does not need to be called explicitly.]
    logicEval: function($block, $data) {
        var searchregex = /\{\{[\s]{0,100}if(.*?)[\s]{0,100}\}\}|\{\{[\s]{0,100}elseif(.*?)[\s]{0,100}\}\}|\{\{[\s]{0,100}else[\s]{0,100}\}\}|\{\{[\s]{0,100}endif[\s]{0,100}\}\}/g,
            repmatch, snippets = [],
            nextindex = 0,
            numBlocks, i, rval, evaluate, compare, cutspot, comparevar, evalchunk;

        // gather some info on the regex matches and their indexes
        while (repmatch = searchregex.exec($block)) {
            snippets.push({ value: repmatch[0], index: repmatch.index, endindex: repmatch.index + repmatch[0].length });
        }

        numBlocks = snippets.length;
        for (i = 0; i < numBlocks; i = i + 1) {

            // so we don't do inner loops by accident
            if (i !== nextindex) { continue; }

            // trimmed statement without brackets
            rval = snippets[i].value.replace(/\{\{|\}\}/g, '').replace(/^\s+|\s+$/g,"");

            // if/elseif statement
            if (rval.indexOf('if') === 0 || rval.indexOf('elseif') === 0)
            {
                // assuming that we stop looping if we satisfy the first if, we can put these conditionals in the same block

                evaluate = false;
                compare = true;

                // get bool from statement
                if (rval.indexOf('!:') !== -1 )
                    compare = false;

                cutspot = rval.indexOf(':') + 1;
                // get var from statement
                rval = rval.substr(cutspot, rval.length);

                // below are the situations where we would evaluate
                if ($data[rval] === undefined && compare === false)
                {
                    evaluate = true;
                }
                else if ($data[rval] === undefined && compare === true)
                {
                    // just covering bases here
                    evaluate = false;
                }
                else 
                {
                    comparevar = parseInt($data[rval]);
                    if(isNaN(comparevar)){
                        comparevar = $data[rval];
                        if (comparevar === '')
                            comparevar = false;
                        else
                            comparevar = true;
                    }
                    if (!comparevar && compare === false)
                    {
                        evaluate = true;
                    }
                    else if (comparevar && compare === true)
                    {
                        evaluate = true;
                    }
                }

                // use this chunk if we're looking good
                if (evaluate)
                {
                    evalchunk = $block.substr(snippets[i].endindex, snippets[bowtie.getNextInTier(i, snippets)].index - snippets[i].endindex);
                    // evaluate inner logic blocks if there are any, and return data
                    return bowtie.blockchunker(evalchunk, $data, 'if');
                }
                else
                {
                    nextindex = bowtie.getNextInTier(i, snippets);
                }
            }

           
            // else statement
            if (rval.indexOf('else') === 0)
            {
                // we skipped the first section so we know that whatever belongs here must be shown
                evalchunk = $block.substr(snippets[i].endindex, snippets[bowtie.getNextInTier(i, snippets)].index - snippets[i].endindex);
                // evaluate inner logic blocks if there are any, and return data
                return bowtie.blockchunker(evalchunk, $data, 'if');
            }

            // end if statement
            if (rval.indexOf('end') === 0)
            {
                // nothing was satisfied so we can just return nothing
                return '';
            }
        }
    },


    // GETNEXTINTIER
    // This is the workaround for only evaluating a single tier of a logic block at a time.
    // It searches for an elseif, else, or endif statement and goes into "skipping mode" if it finds a new if statement
    // [this is called inside of LOGICEVAL and does not need to be called explicitly.]
    getNextInTier: function ($currentindex, $snippets) {
       var sniplen = $snippets.length,
           skipping = 0,
           i, rval;
       for (i = $currentindex + 1; i < sniplen; i = i + 1)
       {   
           rval = $snippets[i].value.replace(/\{\{|\}\}/g, '').replace(/^\s+|\s+$/g,"");
           if (skipping > 0) 
           {
               if (rval.indexOf('endif') === 0) {
                   skipping = skipping - 1;
               }

               if (rval.indexOf('if') === 0) { 
                   skipping = skipping + 1; 
               }
           }
           else
           {
               // go to skipping mode if we hit a new inner tier
               if (rval.indexOf('if') === 0) { 
                   skipping = skipping + 1; 
                   continue; 
               }

               // no skipping, we have a returnable
               return i;
           }
       }
   },


    // LOOPTOKENIZE
    // Tokenizes the loops to save processing time when looping
    // This function takes a block and recusively replaces the chunk with a "token".
    // When eval time comes, the token's html is saved in an object and happily cached for when the token is read over and over again.
    // [this is called inside of BLOCKCHUNKER and does not need to be called explicitly.]
    loopTokenize: function ($block, $data) {
        var searchregex = /\{\{[\s]{0,100}loop\:(.*?)[\s]{0,100}\}\}|\{\{[\s]{0,100}endloop[\s]{0,100}\}\}/g,
            repmatch, snipstack = [], stacklen = 0, snippets = [], tokens = {},
            sniplen, rval, topmatch, toplen, bottomlen, tokenname, cutblock, i;

        // gather some info on the regex matches and their indexes
        while (repmatch = searchregex.exec($block)) {
            snippets.push({ value: repmatch[0], index: repmatch.index, endindex: repmatch.index + repmatch[0].length });
        }

        // we need to loop through these blocks and tokenize them so we aren't repetedly parsing out the loop every time.
        sniplen = snippets.length;
        for (i = 0; i < sniplen; i = i + 1)
        {
            // trimmed statement without brackets
            rval = snippets[i].value.replace(/\{\{|\}\}/g, '').replace(/^\s+|\s+$/g,"");

            // add a loop to the stack if it's a {{loop:var}}
            if (rval.indexOf('loop:') === 0)
            {
                snipstack[stacklen] = snippets[i];
                stacklen = stacklen + 1;
            }

            // pop a loop from the stack if we have {{endloop}}, 
            // then cut out the chunk, save it in an array, and replace it in the original string with a token
            if (rval.indexOf('endloop') === 0)
            {
                if ((stacklen - 1) < 0) {
                    console.error('ERROR loopEval: {{endloop}} was found but {{loop:var}} was expected');
                    return false;
                }

                topmatch = snipstack.pop();
                stacklen = stacklen - 1;

                toplen = topmatch.value.length;
                bottomlen = snippets[i].value.length;
                // the token name is in the form of var_randomNumber  (example: candidates_782627) 
                // this is so we can use the same loop subject but in different places with different outcomes
                tokenname = topmatch.value.replace(/\{\{|\}\}/g, '').replace(/^\s+|\s+$/g,"").replace(/loop|\s|:/g, '')+'___'+(Math.floor((Math.random()*1000000000)+1));

                // cut out the whole chunk including the top/bottom blocks
                cutblock = $block.substr(topmatch.index, snippets[i].endindex-topmatch.index);
                // replace the chunk with a stand-in token
                $block = $block.replace(cutblock, '{_{_'+tokenname+'_}_}');
                // cut the ends off of the block before we save it
                cutblock = cutblock.substr(toplen, cutblock.length - toplen - bottomlen);
                // put the chunk into an object and continue;
                tokens[tokenname] = cutblock;
            }
        }

        return bowtie.loopEval($block, tokens, $data);
    },


    // LOOPEVAL
    // The actual looping of the data, after the structure has been tokenized.
    // NOTE: Global variables with the same name as inner loop local variables will be overridden inside the loop where the local var exists.
    //       This does not effect the global variables later on in the template when the loop ends.
    //
    // example: {{name}} can be set globally for the username and also in a loop for some contact info. Once the loop ends, {{name}} is back to the unmodified original
    loopEval: function($block, $tokens, $data) {
        // the whole block has been tokenized, so lets start by getting the variable in question and the first inner value
        var tokensplit = $block.replace(/\{_\{_|_\}_\}/g, '').split('___'),
            getvar = tokensplit[0],
            innertoken = $tokens[getvar+"___"+tokensplit[1]],
            returnable = '', 
            targetvar, targetlen, o, copycanvas, nextTierLoops, nextTierCount,
            passdata, j;

        // if this loop exists, run the loop
        if ($data[getvar] !== undefined) {
            // targetvar is an ONLY AN ARRAY, not an OBJECT
            targetvar = $data[getvar];
            targetlen = targetvar.length;
            for (o = 0; o < targetlen; o = o + 1) {

                // copy a fresh string
                copycanvas = innertoken;

                // check for inner tokens and evaluate recursively
                nextTierLoops = innertoken.match(/\{_\{_(.*?)_\}_\}/g);
                nextTierCount = 0;
                if (nextTierLoops !== null)
                nextTierCount = nextTierLoops.length;
                passdata = {};
                passdata = $.extend(passdata, $data);
                passdata = $.extend(passdata, targetvar[o]);
                passdata.loopcounter = o;
                if ( nextTierCount > 0 ) {
                    for (j = 0; j < nextTierCount; j = j + 1) {
                        copycanvas = copycanvas.replace(nextTierLoops[j], bowtie.loopEval(nextTierLoops[j], $tokens, passdata));
                    }
                }

                // satisfy any get: commands
                passdata = bowtie.scopetron(copycanvas, passdata);

                // do any if/else statements in the block
                copycanvas = bowtie.blockchunker(copycanvas, passdata, 'if');

                // fill in the variables from the loop
                copycanvas = bowtie.variablizer(copycanvas, passdata);

                // add on to the full string
                returnable = returnable + copycanvas;
            }
            return returnable;
        }
        else
        {
            return innertoken;
        }
    }
}



/**
 *
 * String.prototype.slugify
 * Geoff Daigle - 2012
 * ported from http://milesj.me/snippets/javascript/slugify
 * Takes a string and removes everything but qualified chars, then adds dashes into the spaces
 * USED FOR THE {{slug:VAR}} command in bowtie
 *
 */
String.prototype.slugify = function (text) {
    // "this" returns an array of chars in a string prototype, strangely.
    // So, naturally, we convert that here.
    var slugobj = this.toString().toLowerCase();
    // Do the rest of our operations
    slugobj = slugobj.replace(/[^-a-zA-Z0-9,&\s]+/ig, '');
    slugobj = slugobj.replace(/-/gi, "_");
    slugobj = slugobj.replace(/\s/gi, "-");
    return slugobj; 
}