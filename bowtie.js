/* ================================================================================================
 *    _        _
 *   | \      / | 
 *   |  \ __ /  |
 *   |   |__|   |
 *   |  /    \  |
 *   |_/      \_| 
 * 
 *   Bowtie.js
 *   @version 1.5.0
 *
 *   A super-classy client-side templating system.
 *
 *   @author Geoff Daigle
 *
 * ================================================================================================
 */



(function( window, undefined ) {

// set up the class varibales
var 

	/**
	 	Shortcuts to core javascript functions
	 */
	array_push = Array.prototype.push,
	array_slice = Array.prototype.slice,
	array_indexOf = Array.prototype.indexOf,
	object_toString = Object.prototype.toString,
	object_hasOwnProp = Object.prototype.hasOwnProperty,
	string_trim = String.prototype.trim,

	
	/**
	 	Shortcuts for regex searches
	 */

	// string with html tags inside
	reg_detect_html = /^(?:[^#<]*(<[\w\W]+>)[^>]*$|#([\w\-]*)$)/,
	// {{ anything }}
	reg_all_bowties = /\{\{(.*?)\}\}|\{_\{_(.*?)_\}_\}/g,
	// {{ anything }}  non-global
	reg_check_bowtie = /\{\{(.*?)\}\}/,
	// {{VAR}}
	reg_bowtie_var = /\{\{[\s]{0,100}(.*?)[\s]{0,100}\}\}/g,
	 // (10)
	reg_num_parens = /\(([0-9]{1,100})\)/g,
	 // {{#}} and {{/#}}
	reg_block_hash = /\{\{[\s]{0,100}\#[\s]{0,100}\}\}(.*?)\{\{[\s]{0,100}\/\#[\s]{0,100}\}\}/g,
	reg_hash_start = /\{\{[\s]{0,100}\#[\s]{0,100}\}\}/,
	reg_hash_end = /\{\{[\s]{0,100}\/\#[\s]{0,100}\}\}/,
	// {{include: VAR as ALIAS}} or {{include: VAR}}
	reg_block_include = /\{\{[\s]{0,100}include:(.*?)[\s]{0,100}as[\s]{0,100}(.*?)[\s]{0,100}\}\}|\{\{[\s]{0,100}include:[\s]{0,100}(.*?)[\s]{0,100}\}\}/g,
	// {{template: TEMPLATE_NAME}}
	reg_block_template = /\{\{[\s]{0,100}template:(.*?)[\s]{0,100}\}\}/g,
	// {{get: VAR[PROP=OBJECT]}}
	reg_block_get = /\{\{[\s]{0,100}get:(.*?)[\s]{0,100}\}\}/g,
	// {{Var = VAL}}
	reg_block_assign = /\{\{[\s]{0,100}[a-zA-Z0-9]{1,100}=(.*?)[\s]{0,100}\}\}/g,
	// {{foreach: VAR}} and {{endforeach}}
	reg_block_loop = /\{\{[\s]{0,100}foreach\:(.*?)[\s]{0,100}\}\}|\{\{[\s]{0,100}endforeach[\s]{0,100}\}\}/g,
	// {{with: VAR}} and {{endwith}}
	reg_block_with = /\{\{[\s]{0,100}with\:(.*?)[\s]{0,100}\}\}|\{\{[\s]{0,100}endwith[\s]{0,100}\}\}/g,
	// {{if: VAR}} and {{endif}}
	reg_block_if = /\{\{[\s]{0,100}if(.*?)[\s]{0,100}\}\}|\{\{[\s]{0,100}endif[\s]{0,100}\}\}/g,
	// {{if: VAR}} and {{if!: VAR}} and {{elseif: VAR}} and {{elseif: VAR}} and {{else}} and {{endif}}
	reg_if_elseif = /\{\{[\s]{0,100}if(.*?)[\s]{0,100}\}\}|\{\{[\s]{0,100}elseif(.*?)[\s]{0,100}\}\}|\{\{[\s]{0,100}else[\s]{0,100}\}\}|\{\{[\s]{0,100}endif[\s]{0,100}\}\}/g,
	// for removing {_{_  _}_} from tokens while tokenizing loops and logic blocks
	reg_token_brackets = /\{_\{_|_\}_\}/g,
	// gets {_{_TOKENVAR_}_} for evaluating loops and logic blocks
	reg_tokens = /\{_\{_(.*?)_\}_\}/g,
	// get all whitespace chars
	reg_whitespace = /\s+/,
	// get all non-whitespace chars
	reg_not_whitespace = /\S/,
	// only selects the space at the very beginning and very end of a string
	reg_trim_ends = /^\s+|\s+$/,
	// for \s that are in a row (like \s\s\s\s\s)
	reg_big_spaces = /[\s]{1,1000}/g,
	// for removing all brackets and whitespace
	reg_brackets_trim = /\{\{|\}\}|\s/g,
	// for removing all brackets only
	reg_brackets = /\{\{|\}\}/g,
	// parentheses
	reg_parens = /\(|\)/g,
	// colon at the beginning of a string
	reg_start_colon = /^:/g,
	// trim command [ trim(#): ]
	reg_command_trim = /trim\((.*?)\):/g,
	// include command [ {{include:}} ]
	reg_command_include = /\{\{|include|\:|\}\}/g,
	// template command [ {{template}} ]
	reg_command_template = /\{\{|template\:|\s|\}\}/g,
	// get command [ get: ]
	reg_command_get = /get:/,
	// loop command [ loop: ]
	reg_command_loop = /foreach|\s|:/g,
	// truncate(#):
	reg_truncate = "truncate\\((.*?)\\)\\:",

	// (Taken from jQuery)
	str_reg_all_whitespace = "[\\x20\\t\\r\\n\\f]";
	// (Taken from jQuery)
	reg_trim = new RegExp( "^" + str_reg_all_whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + str_reg_all_whitespace + "+$", "g" ),


	/**
		Populated later - holds strings for use with util.get_type
		@private
	 */
	class_types = {},

	/**
		A collection of function names and code to do variable manipulation 
		@private
	 */
	registered_plugins = [],


	/**
		The amount of time it took to fully render a template when populate() was last called
		@private
	 */
	last_render_time = '0',


	/**
	 	Initializer for the window.bowtie object	
		@public
	 */
	bowtie_app = function() {
		return bt;
	},


	/**
    	@namespace Object which contains all of the publicly-available functions
    	@public
	*/
	bt_factory = bt = {},


	/**
    	@namespace Template markup goes here for storage when imported
    	@private
	*/
    template_cache = {},


    /**
	 	@namespace A place to store data manipulation functions. All plugins are appended here.
	 	@private
	 */
    fn = {},


    /**
	    @namespace Utility functions to help with template parsing and population
	    @private
	*/
	util = {},


	/**
	    @namespace Holds the token data for foreach blocks
	    @private
	*/
	loop_tokens = {},


	/**
	    @namespace Holds the token data for if/elseif/else blocks
	    @private
	*/
	if_tokens = {},


	/**
	    @namespace Holds the token data for "with" blocks
	    @private
	*/
	with_tokens = {};




    //---------------------------------------------------------------------------------------------
	// Public functions



	/**
	   	The main function which takes a template (or templates) and populates them with data from
	   	an included object.

	    @name bowtie.populate
	    @public
	    @function
	    @param {String|String[]} A string or array of strings
	    @param {Object} An object with all of the data to be imported into the template
	    @returns {String} The template with all {{ }} tags handled and replaced
	 */
	bt_factory.populate = function($template_raw, $input_data) {

		// Get the full template in question and mount the data to be imported
		var bench_start = new Date().getTime(), bench_end,
			working_template = util.compile_raw_template($template_raw),
			global_data = $input_data;

		// validate the $input_data parameter
		if (global_data === undefined || typeof global_data !== 'object'){
		    global_data = {};
		} 

		// ------------------------------------
		//	Prepare
		// ------------------------------------

		// Collect all template html that might be referenced inside this template. {{template}}
		working_template = fn.collect_templates.call(working_template); 
		
		// Create a separate block instance for any blocks surrounded by {{#}} {{/#}} 
		// (Population is carried out separately here.. this is like javascript's eval() so 
		//  use sparingly)
		working_template = fn.do_eval_populate.call(working_template, global_data);

		// Take other external data and merge it with the global_data object. {{include}}
		global_data = fn.global_merge.call(working_template, global_data); 


		// ------------------------------------
		//	Tokenize
		// ------------------------------------

		// tokenize foreach statements for later evaluation {{with}}
		working_template = fn.tokenize_with.call(working_template);

		// tokenize foreach statements for later evaluation {{foreach}}
		working_template = fn.tokenize_foreach.call(working_template);

		// tokenize if/elseif/else statements for later evaluation {{if}}
		working_template = fn.tokenize_if.call(working_template);

		// ------------------------------------
		//	Evaluate
		// ------------------------------------

		// Satisfy any top-level {{get}} commands
		global_data = fn.include_data_in_scope.call(working_template, global_data);

		// evaluate loops {{with}} -- includes {{if}} {{foreach}} {{get}} and {{var}}
		working_template = fn.evaluate_tokens(working_template, with_tokens, global_data, 'with');

		// evaluate loops {{foreach}} -- includes  {{get}} and {{var}}
		working_template = fn.evaluate_tokens(working_template, loop_tokens, global_data, 'foreach');

		// evaluate if statements {{if}} -- includes  {{get}} and {{var}}
		working_template = fn.evaluate_tokens(working_template, if_tokens, global_data, 'if');

		// populate regular variables and/or do some basic string manipulation {{VAR}}
		working_template = fn.render_variables.call(working_template, global_data);

		// ------------------------------------
		//	Clean up
		// ------------------------------------

		// get rid of the extra {{}}
		working_template = fn.sweep_extra_blocks(working_template);

		// scrap the token data
		if_tokens = {};
		loop_tokens = {};
		with_tokens = {};

		// get the benchmark time and save it
		bench_end = new Date().getTime();
		last_render_time = bench_end - bench_start;

		if (bt_factory.debug === true) {
			console.log('Bowtie: Generated template in '+bt.last_render_time());
		}

		// order up!
		return working_template;
	};


	/**
    	Toggle debug info

    	@public
	*/
	bt_factory.debug = false;


	/**
	   	Shorthand for running populate without passing any data. 
	   	Typically used for fetching data.

	    @name bowtie.get
	    @public
	    @function
	    @param {String|String[]} A string or array of strings
	    @returns {String} The template with all {{ }} tags handled and replaced
	 */
	bt_factory.get = function($template_raw) {
		return bt.populate($template_raw, {});
	};


	/**
	   	Searches through the cached templates 
	   	Only used for fetching data.

	    @name bowtie.get_raw
	    @public
	    @function
	    @param {String} A string specifying the name of the cached template
	    @returns {String} The template with NO ALTERATIONS
	 */
	bt_factory.get_raw = function($template_key) {
		return util.compile_raw_template($template_key);
	};


	/**
	   	Takes an object of template strings and pushes it to the template_cache variable

	    @name bowtie.load
	    @public
	    @function
	    @param {String|Boolean} the template key to call when loading the template, or true
	    @param {string} teh template object
	    @returns {Boolean} True if success, false if not.
	 */
	bt_factory.load = function($template_key, $template_str) {

		// overwrite everything if first param is true because we have json
		if ($template_key === true && util.get_type($template_str) === 'object') {
			template_cache = $template_str;
			return true;
		}

		if (util.get_type($template_str) !== 'string' || util.get_type($template_key) !== 'string' ) {
			return false;
		}

		var template_pointer = template_cache,
			key_steps = $template_key.replace(/\s/g, '').split('.'),
			key_pointer;


		// get the right pointer object
		while (key_steps.length !== 0) {
			key_pointer = key_steps.shift();
			// if the object doesnt exist, create it
			if (template_pointer[key_pointer] === undefined) {
				template_pointer[key_pointer] = {};
			}
			// re-orient
			if (key_steps.length !== 0) {
				template_pointer = template_pointer[key_pointer];
			}
		}
		// save the template
		template_pointer[key_pointer] = $template_str;
		return true;
	};


	/**
    	A pointer to an object which contains client-side data used for populating templates.
	    This is optional and allows users to utilize the {{include:VAR as ALIAS}} function.

	    @public
	*/
	bt_factory.db_pointer = {};


	/**
	   	Takes a plugin function and adds it to the registered_plugins array for later use

	    @name bowtie.register_plugin
	    @public
	    @function
	    @param {String} The name of the plugin
	    @param {RegExp} The regex selector to match against the tag
	    @param {Function} The plugin function
	    @returns {Boolean} True if success, false if name is in use.
	 */
	bt_factory.register_plugin = function($plugin_name, $plugin_selector, $plugin_function) {
		var can_add = true, sel_is_func = util.get_type($plugin_selector) === 'function';

		$plugin_name = $plugin_name.replace(reg_whitespace, '');
		util.for_each(registered_plugins, function() {
			if ($plugin_name === this.name) {
				can_add = false;
				return false;
			}
		});

		// we can do a shorthand registration by passing only a string and a callback
		// to this function instead of those two and also a regex object
		if (sel_is_func && util.get_type($plugin_name) === 'string') {
			$plugin_function = $plugin_selector;
			// we create a regex selector from the string name
			$plugin_selector = new RegExp($plugin_name+"\\:", 'i');
		} else if (sel_is_func) {
			can_add = false;
		}

		if (can_add) {
			registered_plugins.push({
				name: $plugin_name,
				selector: $plugin_selector,
				modifier: $plugin_function
			});
		}

		return can_add;
	}; 


	/**
	   	Returns the amount of time the last template rendering took

	    @name bowtie.last_render_time
	    @public
	    @function
	    @returns {String} The last render time in miliseconds
	 */
	bt_factory.last_render_time = function() {
		var t_render = last_render_time;
		if (t_render === 0){
			return 'less than 1 ms';
		} else {
			return String(t_render)+'ms';
		}	
	};


	/**
	   	Returns the template_cache object with all saved templates

	    @name bowtie.get_templates
	    @public
	    @function
	    @returns {Object} The template_cache object
	 */
	bt_factory.get_templates = function() {
		return template_cache;
	};



	//---------------------------------------------------------------------------------------------
	// Data Manipulation Functions


	/**
	  	A simple cleanup script to remove extra {{}}'s

	    @name fn.sweep_extra_blocks
	    @private
	    @function
	    @param {String} The template string
	    @returns {String} The sting, minus all of the leftover bracket vars
	 */
	fn.sweep_extra_blocks = function( $working_template ){
		util.match_loop($working_template, reg_all_bowties, function($match) {
            $working_template = $working_template.replace($match, '');
		});
        return $working_template;
    };


	/**
	  	Get all templates that should be included in the template context

	    @name fn.collect_templates
	    @private
	    @function
	    @returns {String} A modified template string
	 */
	fn.collect_templates = function () {
		var t_key = '', t_include = '', t_replace = '', t_temp = this;

		util.match_loop(this, reg_block_template, function($match) {
			t_key = $match.replace(reg_command_template, '');
            t_include =  util.fetch_template(t_key);
            if (t_include !== '') {
            	// recursive template collection
            	t_replace = fn.collect_templates.call(t_include);
            }
            t_temp = t_temp.replace($match, t_replace);
		});

		return t_temp;
	};


	/**
	  	Find data in the bt.db_pointer object that the user has specified;
	  	If you call {{include: VAR}}, you can then output VAR with {{VAR}}

	    @name fn.global_merge
	    @private
	    @function
	    @param {Object} The "global" data object which is to be merged with other data
	    @returns {Object} The modified global data object
	 */
	fn.global_merge = function ($global_data_object) {
		var g_include, dataset_to_merge = {}, temp_dataset, g_include_split, g_insert_obj,
			g_include_key, has_alias, var_alias, used_aliases = [];
	
		// loop through each {{include}} block
		util.match_loop(this, reg_block_include, function($match) {
			temp_dataset = {};
			has_alias = false;
			var_alias = '';
			g_insert_obj = {};

			// remove everything but the "VAR as ALIAS" declaration
			g_include = $match.replace(reg_command_include, '').replace(reg_trim_ends, '')
							  .replace(reg_big_spaces, ' ');


			// check to see if we have an alias name and if so, prep for it
			g_include_split = g_include.split(' as ');
			g_include_key = g_include_split[0].split('.');

			util.for_each(g_include_key, function($i, $val){
				g_include_key[$i] = util.trim($val);
			});

			if (g_include_split[1] !== undefined) {
				var_alias = g_include_split[1];
				has_alias = true;
			} else {
				var_alias = g_include_key[0];
			}

			// safety trim
			var_alias = util.trim(var_alias);

			// get the object that's asked for from bt.db_pointer, or just pass { } if null
			temp_dataset = util.object_rsearch(g_include_key, bt.db_pointer);

			if (temp_dataset === null) {
				temp_dataset = {};
			}

			// if the alias isnt being used already, we add it to our collective dataset
			if (util.in_array(var_alias, used_aliases) === -1) {
			    g_insert_obj[var_alias] = temp_dataset;
			    dataset_to_merge = util.object_merge(true, dataset_to_merge, g_insert_obj);
			    used_aliases.push(var_alias);
			}
		});

		// merge our new data and return it
		$global_data_object = util.object_merge($global_data_object, dataset_to_merge);
		return $global_data_object;
	};


	/**
	  	Run bowtie.populate again from the beginning but with a whole new block of data

	    @name fn.do_eval_populate
	    @private
	    @function
	    @param {Object} The "global" data object which is to be merged with other data
	    @returns {String} A modified template string
	 */
	fn.do_eval_populate = function ($global_data_object) {
		var block_slice, data_copy, t_temp = this;
        // loop through each {{#}} block and run populate()
		util.match_loop(this, reg_block_hash, function($match) {
                block_slice = $match.replace(reg_hash_start, '').replace(reg_hash_end, '');
                data_copy = util.object_merge(true, {}, $global_data_object);
                t_temp = t_temp.replace($match, bt.populate(block_slice, data_copy));
        });
        return t_temp;
	};


	/**
	  	Handle {{get: VAR[PROP=VAL]}} and include the specified data in the current data 
	  	object context

	    @name fn.include_data_in_scope
	    @private
	    @function
	    @param {Object} The data object which is to be merged with other data
	    @returns {String} A modified template string
	 */
	fn.include_data_in_scope = function ($data_object) {
		var get_comm, target_var, selected_var, prop_to_compare;

		// loop through {{get}} blocks
		util.match_loop(this, reg_block_get, function($match) {
	        get_comm = $match.replace(reg_brackets, '');
            target_var = get_comm.replace('get:', '');
            target_var = target_var.split('[');

            // if the split worked, we have a VAR[PROP=VAL] situation
            if (target_var.length > 1) {
            	//  "PROP = VAL"
                prop_to_compare = util.trim(target_var[1].replace(']', ''));
                // the variable name (eg. people_array)
                selected_var = util.trim(target_var[0]);
                // the reference to the object named in the above line
                selected_var = util.object_rsearch(selected_var.split('.'), $data_object);

                if(selected_var !== null) {
                    // if selected_var is an array...
                    if (prop_to_compare.indexOf('=') !== -1 && util.get_type(selected_var) === 'array' ) {


                        var selected_var_length = selected_var.length, index = 0, 
                        	prop_compare_split, selected_var_prop, compare_string, 
                        	compare_variables = true, comparison_result;

                        // Check if we have "PROP ?= VAL" which says that we should compare var to var
                        prop_compare_split = prop_to_compare.split('?=');

                        // if not, we see which PROP has a value of VAL
                        if (prop_compare_split.length === 1) {
                        	compare_variables = false;
                        	prop_compare_split = prop_to_compare.split('=');
                        }
                        
                        // PROP in "PROP = VAL"
                        selected_var_prop = util.trim(prop_compare_split[0]);
                        // VAL in "PROP = VAL"
                        compare_string = util.trim(prop_compare_split[1]);


                        for (; index < selected_var_length; index++){
                            if (selected_var[index][selected_var_prop] !== undefined) {
                            	
                            	if (compare_variables) {
                            		comparison_result = fn.determine_evaluate(selected_var[index][selected_var_prop], false, $data_object[compare_string]);
                            	} else {
                            		comparison_result = fn.determine_evaluate(selected_var[index][selected_var_prop], false, compare_string);
                            	}

                                if (comparison_result) {
                                   	// Delete the property (PROP) that we compared against because:
                                   	// 1. We used an equivalent variable to find the object, and
                                   	// 2. For things like primary keys, different data sets could have the same
                                   	//    property names which could accidentally be overwritten (for example, ID)
                                    var safety_obj = util.object_merge(true, {}, selected_var[index]);
                                    delete safety_obj[selected_var_prop];
                                    // merge data
                                    $data_object = util.object_merge(true, $data_object, safety_obj);
                                    break;
                                } 
                            }
                        }
                    } 
            	}

           	// if there was no split earlier, we have a get: var.prop.prop situation 
           	// and we just get it directly and add it to the data
            } else {
            	selected_var = util.object_rsearch( util.trim(target_var).split('.'), $data_object );
	            if (selected_var !== null) {
	                $data_object = util.object_merge(true, $data_object, selected_var);
	            }
            }

	    });

		return $data_object;
	};


	/**
	  	Match variables specified with data properties and put them into the template.
	  	Plugins are fired here depending on the syntax.

	    @name fn.render_variables
	    @private
	    @function
	    @param {Object} The data object which is to be merged with other data
	    @returns {String} A modified template string
	 */
	fn.render_variables = function ($data_object) {
		var matched_var, matched_var2, mod_function_result, mod_function, scrubbed_var,
			template = this;

		util.match_loop(this, reg_bowtie_var, function($match) {
			matched_var2 = util.trim($match.replace(reg_brackets, ''));
			mod_function_result = util.get_var_mod_function(matched_var2);

			scrubbed_var = mod_function_result[0];
			mod_function = mod_function_result[1];
			matched_var = util.object_rsearch(scrubbed_var.split('.'), $data_object);

			if (matched_var !== null) {
				// modified variable
				if (mod_function !== null) {
					matched_var = mod_function.call(matched_var2, matched_var);
	                template = template.replace($match, matched_var);
	            // regular variable
	            } else {
		            template = template.replace($match, matched_var);
	            }
	        }
		});
		return template;
	};


	/**
	  	Cut "with" blocks into tokens and save each block into an object for later evaluation

	    @name fn.tokenize_with
	    @private
	    @function
	    @param {Object} The data object which is to be evaluated against
	    @returns {String} A modified template string
	 */
	fn.tokenize_with = function() {
		return fn.deep_tokenizer(this, with_tokens, 'with', 'endwith');
	};


	/**
	  	Cut foreach blocks into tokens and save each block into an object for later evaluation

	    @name fn.tokenize_foreach
	    @private
	    @function
	    @param {Object} The data object which is to be evaluated against
	    @returns {String} A modified template string
	 */
	fn.tokenize_foreach = function() {
		var template = this;
		// We modify the working template first...
		template =  fn.deep_tokenizer(this, loop_tokens, 'foreach', 'endforeach');
		// ... then, we already tokenized the "with" statements, so we have to modify the stored data.
		util.for_each(with_tokens, function($i, $val){
			with_tokens[$i] = fn.deep_tokenizer($val, loop_tokens, 'foreach', 'endforeach');
		});
		return template;
	};


	/**
	  	Cut if/each/else blocks into tokens and save each block into an object for later evaluation

	    @name fn.tokenize_if
	    @private
	    @function
	    @param {Object} The data object which is to be evaluated against
	    @returns {String} A modified template string
	 */
	fn.tokenize_if = function() {
		var template = this;
		// We modify the working template first...
		template =  fn.deep_tokenizer(this, if_tokens, 'if', 'endif');
		// ... then, we already tokenized the foreach and "with" statements, so we have to modify the stored data.
		util.for_each(with_tokens, function($i, $val){
			with_tokens[$i] = fn.deep_tokenizer($val, if_tokens, 'if', 'endif');
		});
		util.for_each(loop_tokens, function($i, $val){
			loop_tokens[$i] = fn.deep_tokenizer($val, if_tokens, 'if', 'endif');
		});
		return template;
	};


	/**
	  	Takes a top-tier block and iterates deeply within the string to replace each block with a token string

	    @name fn.deep_tokenizer
	    @private
	    @function
	    @param {String} The html to be tokenized
	    @param {Object} A place for each token to be saved and stored for evaluation
	    @param {String} The syntax of the start tag
	    @param {String} the syntax of the end tag
	    @returns {String} A modified template string
	 */
	fn.deep_tokenizer = function ($block, $container_object, $start_tag, $end_tag) {
	    var singletons = [],
	        the_start_tag = '',
	        target_variable = '',
	     	selector_regexp = util.singleton_block_regexp($start_tag, $end_tag), 
	     	match_count = 0;

	    // Get all of the inner snippets
		singletons = util.get_snippet_meta(selector_regexp, $block);

	    // Walk through each and tokenize individual chunks.
		util.for_each(singletons, function($i, $single_match){
			match_count++;


			// get the first 
			util.match_loop($single_match.value, util.start_tag_regexp($start_tag), function($match) {
				the_start_tag = $match;
				target_variable = the_start_tag.replace(reg_brackets, '').replace(reg_trim_ends,'');
				return false;
			});

            // the token name is in the form of var_randomNumber  (example: candidates_782627) 
            // this is so we can use the same loop subject but in different places with different outcomes
            target_variable = target_variable.split('=');
            token_name = target_variable[0].replace(new RegExp('^'+$start_tag+'|\\=|\\?|\\s|\\:|\\!', 'g'), '')+'___'+(Math.floor((Math.random()*1000000000)+1));

            // replace the block with a stand-in token
            $block = $block.replace($single_match.value, '{_{_'+$start_tag+'::'+token_name+'_}_}');

            // put the block into an object and continue;
            $container_object[token_name] = $single_match.value;

	    });

		// check matches so we can avoid an infinite loop
        if (match_count > 0){
        	// recursivly tokenize on the block object until all are db_pointer
	        $block = fn.deep_tokenizer($block, $container_object, $start_tag, $end_tag);
	    }


	    // return the tokenized block (it should only have one token, the rest are cached for later)
	    return $block;
	};



	/**
	  	Walks through the tokens in a block and tries to evaluate them 

	    @name fn.evaluate_tokens
	    @private
	    @function
	    @param {String} The html to be evaluated
	    @param {Object} the global data object
	    @param {Object} An object containing all of the tokens
	    @param {String} The token prefix
	    @returns {String} A modified template string
	 */
	fn.evaluate_tokens = function($block, $tokens, $data, $prefix) {
        var token_meta = {}, data_copy = {}, token_target = '';

        util.match_loop($block, util.token_select_regexp($prefix), function($match) {
       		token_meta = util.get_token_meta($match);
       		token_target = util.object_rsearch(token_meta.variable.split('.'), $data);

       		// skip this token if it doesnt exist
       		if (token_meta.value === false) {
       			return true;
       		}

       		// skip if the variable in question doesnt exist
			if (token_target === null) {
       			return true;
       		}

       		// safety copy
       		data_copy = util.object_merge(true, {}, $data);

       		if (token_meta.type === 'with') {
       			token_meta.value = fn.with_block_evaluate.call(token_target, token_meta.value , $tokens, data_copy, $prefix);
       		}

       		if (token_meta.type === 'foreach') {
       			token_meta.value = fn.foreach_block_evaluate.call(token_target, token_meta.value , $tokens, data_copy, $prefix);
       		}

       		if (token_meta.type === 'if') {
       			token_meta.value = fn.if_block_evaluate.call(token_target, token_meta.value , $tokens, data_copy, $prefix);
       		}

       		$block = $block.replace($match, token_meta.value);
        });

        return $block;
    };


    /**
	  	Evaluates a with block and does if/foreach evaluations within the block

	    @name fn.with_block_evaluate
	    @private
	    @function
	    @param {String} The html to be evaluated
	    @param {Object} the global data object
	    @param {Object} An object containing all of the tokens
	    @param {String} The token prefix
	    @returns {String} A modified template string
	 */
	fn.with_block_evaluate = function($block, $tokens, $data, $prefix) {
		var tag_matches = $block.match(reg_block_with),
			with_target = tag_matches[0].replace(/\{\{\s{0,100}with|\s|\}\}|\:/g,''),
			with_target = util.object_rsearch(with_target.split('.'), $data),
			data_copy = {};

			$block = $block.replace(tag_matches[0], '').replace(tag_matches[1], '');

			if (with_target !== null) {
				// include the data object being asked for
				if (util.get_type(with_target) === 'object') {
					data_copy = util.object_merge(true, {}, $data, with_target);
				}

				// {{get}}, other tokens, and {{VAR}} replacements
				data_copy = fn.include_data_in_scope.call($block, data_copy);

				// evaluate loops {{foreach}}
				$block = fn.evaluate_tokens($block, loop_tokens, data_copy, 'foreach');

				// evaluate if statements {{if}}
				$block  = fn.evaluate_tokens($block, if_tokens, data_copy, 'if');

				// evaluate inner "with" statements {{with}}
				$block = fn.evaluate_tokens($block, $tokens, data_copy, $prefix);
			
				$block = fn.render_variables.call($block, data_copy);
	
			} 
			return $block;
	};


    /**
	  	Evaluates a foreach block and loops 

	    @name fn.foreach_block_evaluate
	    @private
	    @function
	    @param {String} The html to be evaluated
	    @param {Object} the global data object
	    @param {Object} An object containing all of the tokens
	    @param {String} The token prefix
	    @returns {String} A modified template string
	 */
	fn.foreach_block_evaluate = function($block, $tokens, $data, $prefix) {
		var target_var = this,
			target_type = util.get_type(target_var),
			data_copy = {}, return_string = '', temp_string = '';

		if (target_type !== 'array' && target_var !== 'object') {
			target_var = [ {} ]; // array with empty object as only element
		}

		util.for_each(target_var, function ($i, $ivar){
			temp_string = '';
			if (util.get_type($ivar) === 'object') {
				data_copy = util.object_merge(true, {}, $data, $ivar);
			}

			// isolated instance of {{get}}
			data_copy = fn.include_data_in_scope.call($block, data_copy);

			// evaluate loops {{foreach}}
			temp_string = fn.evaluate_tokens($block, $tokens, data_copy, 'foreach');

			// get rid of the extra foreach blocks
			temp_string = temp_string.replace(reg_block_loop, '');

			// evaluate if statements {{if}}
			temp_string  = fn.evaluate_tokens(temp_string, if_tokens, data_copy, 'if');

			// evaluate inner "with" statements {{with}}
			temp_string = fn.evaluate_tokens(temp_string, with_tokens, data_copy, 'with');

			// because of isolation, we evaluate variables now
			temp_string = fn.render_variables.call(temp_string, data_copy);

			return_string += temp_string;
		});

		return return_string;

	};


	/**
	  	Evaluates an if/elseif/else block and loops 

	    @name fn.if_block_evaluate
	    @private
	    @function
	    @param {String} The html to be evaluated
	    @param {Object} the global data object
	    @param {Object} An object containing all of the tokens
	    @param {String} The token prefix
	    @returns {String} A modified template string
	 */
	fn.if_block_evaluate = function($block, $tokens, $data, $prefix, $tagmatches) {
		// collect the list of tag matches for this block
		if (!$tagmatches) {
			$tagmatches = $block.match(reg_if_elseif);
		}


		var evaluate = true,
			head_tag = util.trim($tagmatches[0].replace(reg_brackets, '')),
			this_tag = 'if',
			inverse = false,
			comparison_var = null,
			target_var = '',
			tag_split = [];

		// determine head_tag type
		if (head_tag.indexOf('elseif') === 0) {
			this_tag = 'elseif';
		} else if (head_tag.indexOf('else') === 0) {
			this_tag = 'else';
		}
		

		// determine if we evaluate
		if (this_tag !== 'else') {

			if (head_tag.indexOf('!:') !== -1) {
				inverse = true;
			}

			tag_split = head_tag.split(':');
			comparison_var = tag_split[1].split('=');
			comparison_var = util.trim(comparison_var[1]);

			if (head_tag.indexOf('?=') !== -1) {
				comparison_var = util.object_rsearch(comparison_var.split('.'), $data);
				target_var = tag_split[1].split('?=');
				target_var = target_var[0];
			} else {
				target_var = tag_split[1].split('=');
				target_var = target_var[0];
			}
			target_var = util.trim(target_var);
			target_var = util.object_rsearch(target_var.split('.'), $data);

			// undefined catch
			if (comparison_var === '') {
				comparison_var = null;
			}

			evaluate = fn.determine_evaluate(target_var, inverse, comparison_var);
		}

		// run evaluation here
		if (evaluate) {
			var data_copy = util.object_merge(true, {}, $data);
			// clean up the block and other unused data
			$block = $block.replace(new RegExp($tagmatches[1]+'(.|\n|\r)*'), '');

			// isolated instance of {{get}}
			data_copy = fn.include_data_in_scope.call($block, data_copy);

			// evaluate loops {{foreach}}
			$block = fn.evaluate_tokens($block, loop_tokens, data_copy, 'foreach');

			// evaluate if statements {{if}}
			$block  = fn.evaluate_tokens($block, if_tokens, data_copy, $prefix);

			// evaluate inner "with" statements {{with}}
			$block = fn.evaluate_tokens($block, with_tokens, data_copy, 'with');
			
			// because of isolation, we evaluate variables now
			$block = fn.render_variables.call($block, data_copy);

		} else {
			// we might have an elseif or else left to try, so keep moving
			if ($tagmatches[2] !== undefined) {
				// remove the previous stuff
				$block = $tagmatches[1] + $block.replace(new RegExp('(.|\n|\r)*'+$tagmatches[1]), '');
				// pop the top of the stack
				$tagmatches.shift();
				// recursively try again on next spot
				$block = fn.if_block_evaluate($block, $tokens, $data, $prefix, $tagmatches);
			} else {
				$block = '';	 
			}
		}
		$block = $block.replace(reg_if_elseif, '');

		return $block;
	};


	/**
	  	Gets truthy or falsy value from variable and returns true or false

	    @name fn.determine_evaluate
	    @private
	    @function
	    @param {Any} A variable
	    @param {Boolean} Inverse modifier
	    @param {Any} A variable to compare against
	    @returns {Boolean} If the variable is truthy
	 */
	fn.determine_evaluate = function($target_var, $inverse, $comparison_var) {
		var target_type = util.get_type($target_var),
			evaluate = true;

		if ($comparison_var !== null) {
			// do a variable2variable comparison
			var comp_type = util.get_type($comparison_var);
			if (comp_type === 'number' || comp_type === 'boolean') {
				$comparison_var = $comparison_var.toString();
			}
			if ($comparison_var === 'false') {
				$comparison_var = '0';
			}
			if ($comparison_var === 'true') {
				$comparison_var = '1';
			}
			if (target_type === 'number' || target_type === 'boolean') {
				$target_var = $target_var.toString();
			}
			if ($target_var === 'false') {
				$target_var = '0';
			}
			if ($target_var === 'true') {
				$target_var = '1';
			}
			// because we converted a few values into strings, comparison is looser
			if ($target_var !== $comparison_var) {
				evaluate = false;
			}

		} else {
			// skip if blank array
			if (target_type === 'array') {
				if ($target_var.length === 0) {
					evaluate = false;
				}
			// skip if empty object
			} else if (target_type === 'object') {	
				evaluate = false;
				var name;
				for ( name in $target_var ) {
					evaluate = true;
					break;
				}
			// skip if string '0' by itself [TODO: this might not be good, get feedback]
			} else if ($target_var === '0') {
				evaluate = false;
			// skip if a falsey value
			} else if (!$target_var) {
				evaluate = false;
			}
		}

		// inverse modifier
		if ($inverse){
			evaluate = (!evaluate);
		}

		return evaluate;
	};





	//---------------------------------------------------------------------------------------------
	// Utilities


	/**
		Figures out and gathers all of the templates specified by the developer in bowtie.populate
	   	Returns a single string containing an HTML template which has not yet been parsed.

	    @name util.compile_raw_template
	    @private
	    @function
	    @param {String} A string (of HTML or a keystring) or an array (of HTML or keystrings)
	    @returns {String} Either a string containing a raw html template, or false if failed.
	 */
	util.compile_raw_template = function($template_obj) {
		var object_type = util.get_type($template_obj),
			returned_template = '',
			valid = true,
			temp_template = '';

		if (object_type === 'string') {
			// if we have a bracket var, it's already a template, else we try to fetch it from the db
		    if (util.in_string($template_obj, reg_check_bowtie)) {
		    	returned_template = $template_obj;
		    } else {
		    	returned_template = util.fetch_template($template_obj);
		    }
		} else if (object_type === 'array') {
			// if $template_obj is an array, we loop through each element and concatenate the templates 
		    util.for_each($template_obj, function($key, $val){
		    	temp_template = util.compile_raw_template($val);
		    	if (temp_template !== false) {
		    		returned_template += temp_template;
		    	}
		    });
		} else {
		    valid = false;
		}

		// check for returned_template equalling false (in case we tried to fetch it)
		if (valid) {
			valid = returned_template !== false;
		}

		// check for empty string or all whitespace
		if (valid) {
			returned_template = returned_template.replace(reg_trim_ends, '');
			valid = returned_template !== '';
		}

		if (valid) {
			return returned_template;
		} else {
			console.error('ERROR: bowtie.populate: No valid template was passed and no valid template '+
				'key was specified. Check the value of the first parameter.');
		    return false;
		}
	};



	/**
	   	Check for instances of modifiers based on the plugin's regex selector

	    @name util.get_var_mod_function
	    @private
	    @function
	    @param {String} The variable's trimmed block
	    @returns {Array} [ scrubbed prop name, function or null ]
	 */
	util.get_var_mod_function = function($var_name) {
		var mod_func = null;
		util.for_each(registered_plugins, function($key, $val) {
			if ($var_name.search($val.selector) === 0) {
				mod_func = this.modifier;
				$var_name = util.trim($var_name.replace($val.selector, ''));
			}
		});
		return [$var_name, mod_func];
	};


	/**
	   	Takes a template key and returns the corresponding string from template_cache

	    @name util.fetch_template
	    @private
	    @function
	    @param {String} The template key
	    @returns {String|Boolean} If the template is found, return it. Else, return false.
	 */
	util.fetch_template = function($template_key) {
		$template_key = $template_key.split('.');
		var templatehtml = util.object_rsearch($template_key, template_cache);
		if (templatehtml === null) {
			return '';
		} else {
			return templatehtml;
		}
	};



	/**
	   	Loops through the template data and returns the inner values and indexes of each match

	    @name util.get_snippet_meta
	    @private
	    @function
	    @param {String} The regular expression to use to find tags
	    @param {String} The template data
	    @returns {Array} An array of objects of snippet data
	 */
	util.get_snippet_meta =  function($selector_regexp, $template) {
		var regexp_match, snippets = [];
		while (regexp_match = $selector_regexp.exec($template)) {
		    snippets.push( { 
		    	value: regexp_match[0], 
		    	index: regexp_match.index, 
		    	endindex: regexp_match.index + regexp_match[0].length 
		    });
		}
		return snippets;
	}


	/**
	   	Creates a regexp object that selects blocks with start and end tags at the lowest possible level

	    @name util.singleton_block_regexp
	    @private
	    @function
	    @param {String} The start tag syntax
	    @param {String} The end tag syntax
	    @returns {RegExp} A regexp object
	 */
	util.singleton_block_regexp = function ($start_tag, $end_tag) {
		return new RegExp('{{\\s{0,100}\\b'+$start_tag+'\\b(?:(?!\\{\\{\\s{0,100}\\b'+$start_tag+'\\b).|\\n|\\r)*?\\b'+$end_tag+'\\b\\s{0,100}}}', 'g');
	};


	/**
	   	Creates a regexp object that selects only the start tags of a block

	    @name util.start_tag_regexp
	    @private
	    @function
	    @param {String} The start tag syntax
	    @returns {RegExp} A regexp object
	 */
	util.start_tag_regexp = function($start_tag) {
		return new RegExp('\\{\\{[\\s]{0,100}'+$start_tag+'(.*?)[\\s]{0,100}\\}\\}', 'g');
	};


	/**
	   	Creates a regexp object that selects the start and end tags of a block

	    @name util.start_end_tag_regexp
	    @private
	    @function
	    @param {String} The start tag syntax
	    @param {String} The end tag syntax
	    @returns {RegExp} A regexp object
	 */
	util.start_end_tag_regexp = function($start_tag, $end_tag) {
		return new RegExp('\\{\\{[\\s]{0,100}'+$start_tag+'(.*?)[\\s]{0,100}\\}\\}|\\{\\{[\\s]{0,100}'+$end_tag+'[\\s]{0,100}\\}\\}', 'g');
	};


	/**
	   	Creates a regexp object that selects a particular type of token

	    @name util.token_select_regexp
	    @private
	    @function
	    @param {String} The token prefix syntax
	    @returns {RegExp} A regexp object
	 */
	util.token_select_regexp = function($prefix) {
		return new RegExp('\\{\\_\\{\\_'+$prefix+'\\:\\:(.*?)\\_\\}\\_\\}', 'g');
	};


	/**
	   	Parses a token and returns an object of useful meta

	    @name util.get_token_meta
	    @private
	    @function
	    @param {String} The token string
	    @returns {Object} An object conatining useful data on this token
	 */
	util.get_token_meta = function($token) {
		var token_meta = {},
			t_working = $token.replace(/\{_\{_|_\}_\}/g, '').split('::'),
			t_type = t_working[0],
			t_var = '';

		token_meta.value = false;
		token_meta.type = t_type;
		token_meta.token = t_working[1];

		switch(t_type) {
			case 'if':
				token_meta.value = util.get_token(if_tokens, token_meta.token);
				break;
			case 'foreach':
				token_meta.value = util.get_token(loop_tokens, token_meta.token);
				break;
			case 'with':
				token_meta.value = util.get_token(with_tokens, token_meta.token);
				break;
		}

		t_var = token_meta.token.split('___');
		token_meta.variable = t_var[0];

		return token_meta;
	};


	/**
	   	Gets a token value by name out of it's container object

	    @name util.get_token
	    @private
	    @function
	    @param {Object} The collection of tokens
	    @param {String} The token's name
	    @returns {String|Boolean} The token's value or false
	 */
	util.get_token = function($token_object, $token_name) {
		var token_val = false;
		if (object_hasOwnProp.call($token_object, $token_name)) {
			token_val = $token_object[$token_name];
		}
		return token_val;
	};


	/**
	   	Recursive search for a particular object property in an object tree

	    @name util.object_rsearch
	    @private
	    @function
	    @param {Array} The path of the search within the objects  - eg. ['employer', 'widgets', 'sidebar']
	    @param {Object} The pointer to the current object in the recursive search
	    @returns If the needle is found, return it. Else, return null.
	 */
	util.object_rsearch = function($obj_steps, $obj_pointer) {
		if ($obj_steps === undefined || $obj_pointer === undefined) {
			return null;
		}
		var next_path = $obj_steps.shift(),
			steps_left = $obj_steps.length,
			obj_type = util.get_type($obj_pointer);
		if (util.get_type(next_path) !== 'string' || (obj_type !== 'object' && obj_type !== 'array')) {
			return null;
		}

		// check for existance of .eq(#)
		if (next_path.indexOf('eq(') === 0) {
			next_path = parseInt(next_path.replace(/eq\(|\)|\s/, ''));
			// get the array object index
			if ($obj_pointer[next_path] !== undefined) {
				if (steps_left === 0) {
					return $obj_pointer[next_path];
				} else {
					return util.object_rsearch($obj_steps, $obj_pointer[next_path]);
				}
			} else {
				return null;
			}

		// unfortnately, if we are pointing to an array and the eq() isn't present, we cant progress so we're done
		} else if (obj_type === 'array') {
			return null;
		}

		// if everything validates, we check for the existence of the property and return the proper data
		if (next_path in $obj_pointer) {
			if (steps_left === 0) {
				return $obj_pointer[next_path];
			} else {
				return util.object_rsearch($obj_steps, $obj_pointer[next_path]);
			}
		} else {
			return null;
		}
	};


 	/**
	   	Does a regex search in a string and return true if that string is found in the haystack

	    @name util.in_string
	    @private
	    @function
	    @param {String} The haystack to search within
	    @param {String} The string to be found
	    @returns {Boolean} If the needle is found, return true. Else, return false.
	 */
	util.in_string = function($haystack, $needle) {
		$needle = (util.get_type($needle) === 'regexp')? $needle : new RegExp($needle, 'i');
		return $haystack.match($needle) !== null;
	};


    /**
	   	Removes all characters from a string except a-z, 0-9, dash, underscores, ampersands 
	   	and commas.

	    @name util.slugify
	    @private
	    @function
	    @param {String} A string to be made into a slug
	    @returns {String} A slugified string
	 */
	util.slugify = function ($string) {
		var slug_target = $string.toLowerCase();
	    slug_target = slug_target.replace(/[^-a-zA-Z0-9,&\s]+/ig, '');
	    slug_target = slug_target.replace(/-/gi, "_");
	    slug_target = slug_target.replace(/\s/gi, "-");
	    return slug_target;
	};

	/**
		Removes the whitespace from the beginning and end of a string.
		Uses Native trim function if possible

	    @name util.trim
	    @private
	    @function
	    @param {String} A string to be trimmed
	    @returns {String} A trimmed string
	 */
	util.trim = string_trim && !string_trim.call("\uFEFF\xA0") ?
		function( $text ) {
			return $text == null ?
				"" :
				string_trim.call( $text );
		} :

		// if no core trim, use our own trimming functionality
		function( $text ) {
			return $text == null ?
				"" :
				( $text + "" ).replace( reg_trim, "" );
		};


	/**
	   	Boolean function to see if an object is an array.

	    @name util.is_array
	    @private
	    @function
	    @param {Object} Any object
	    @returns {Boolean} True if an object is of type "array"
	 */
	util.is_array = Array.isArray || function ( $obj ) {
		return (util.get_type( $obj ) === "array");
	};


	/**
	   	Boolean function to see if an object is a function.

	    @name util.is_function
	    @private
	    @function
	    @param {Object} Any object
	    @returns {Boolean} True if an object is of type "function"
	 */
	util.is_function = function( $obj ) {
		return util.get_type( $obj ) === "function";
	};


	/**
	   	Checks to see if target is a "plain" object (taken from jQuery's is_plain_object() function)

	    @name util.is_plain_object
	    @private
	    @function
	    @param {Object} Any object
	    @returns {Boolean} True if an object satisfies all comparisons
	 */
	util.is_plain_object = function( $obj ) {
		// Must be an $object.
		// Because of IE, we also have to check the presence of the constructor property.
		// Make sure that DOM nodes and window $objects don't pass through, as well
		if ( !$obj || util.get_type($obj) !== "$object" || $obj.nodeType || util.is_window( $obj ) ) {
			return false;
		}

		try {
			// Not own constructor property must be $object
			if ( $obj.constructor &&
				!object_hasOwnProp.call($obj, "constructor") &&
				!object_hasOwnProp.call($obj.constructor.prototype, "isPrototypeOf") ) {
				return false;
			}
		} catch ( e ) {
			// IE8,9 Will throw exceptions on certain host $objects #9897
			return false;
		}

		// Own properties are enumerated firstly, so to speed up,
		// if last one is own, then all properties are own.
		var key;
		for ( key in $obj ) {}

		return key === undefined || object_hasOwnProp.call( $obj, key );
	};


	/**
	   	Checks to see if target is the window object (taken from jQuery's is_window() function)

	    @name util.is_window
	    @private
	    @function
	    @param {Object} Any object
	    @returns {Boolean} True if an object satisfies all comparisons
	 */
	util.is_window = function( $obj ) {
		return  $obj != null &&  $obj ==  $obj.window;
	};


	/**
	   	Returns a string of the given object's type

	    @name util.get_type
	    @private
	    @function
	    @param {Object} Any object
	    @returns {String} True if an object is of type "array"
	 */
	util.get_type = function ( $obj ) {
		return ($obj === null)? 
				String($obj) 
				: ( class_types[ object_toString.call($obj) ] || "object" );
	};


	/**
	   	Returns the index of an object in an array, or -1 (taken from jQuery's inArray() function)

	    @name util.in_array
	    @private
	    @function
	    @param {Array} The needle
	    @param {Array} The Haystack
	    @param {Integer} The length counter
	    @returns {Integer} Index of match, or -1
	 */
	util.in_array = function( elem, arr, i ) {
		var len;

		if ( arr ) {
			if ( array_indexOf ) {
				return array_indexOf.call( arr, elem, i );
			}

			len = arr.length;
			i = i ? i < 0 ? Math.max( 0, len + i ) : i : 0;

			for ( ; i < len; i++ ) {
				// Skip accessing in sparse arrays
				if ( i in arr && arr[ i ] === elem ) {
					return i;
				}
			}
		}

		return -1;
	};


	/**
	   	Loop through the properties of an object or elements of an array and apply
	   	a callback to each. (Taken from jQuery's each() function)

	    @name util.for_each
	    @private
	    @function
	    @param {Object} Any object
	    @param {Function} Any function to be called on every iteration
	    @param {Object} Any object to be passed to the callback
	    @returns {Object} The looped object param
	 */
	util.for_each = function( $obj, $callback, $args ) {
		var name,
			i = 0,
			length = $obj.length,
			isObj = length === undefined || util.is_function( $obj );

		/* 
			Loop over object properties and kill loop if any callback returns false
		*/

		// if $args is passed, we pass that to each callback function
		if ( $args ) {
			if ( isObj ) {
				for ( name in $obj ) {
					if ( $callback.apply( $obj[ name ], $args ) === false ) {
						break;
					}
				}
			} else {
				// NOTE: loop only once if not actually an object
				for ( ; i < length; ) { 
					if ( $callback.apply( $obj[ i++ ], $args ) === false ) {
						break;
					}
				}
			}

		// For the more common utilization, we fire this loop
		} else {
			if ( isObj ) {
				for ( name in $obj ) {
					if ( $callback.call( $obj[ name ], name, $obj[ name ] ) === false ) {
						break;
					}
				}
			} else {
				for ( ; i < length; ) {
					if ( $callback.call( $obj[ i ], i, $obj[ i++ ] ) === false ) {
						break;
					}
				}
			}
		}

		return $obj;
	};


	/**	
	   	A "for_each" and a regex conditional combined into one function.

	    @name util.match_loop
	    @private
	    @function
	    @param {String} Any string
	    @param {RegExp} A regex object to match against the string
	    @param {Function} A callback function for any 
	    @returns first param string
	 */
	util.match_loop = function($string, $match, $callback) {
		var sniffer = $string.match($match),
		    str_match_lenth, i = 0, ret = true;
		if (sniffer !== null) {
		    str_match_lenth = sniffer.length;
		    for (; i < str_match_lenth; i++) {
		        ret = $callback(sniffer[i]);
		        if (ret === false) {
		        	break;
		        }
		    }
		}

		return $string;
	};



	/**	
	   	Takes two or more objects and merges their properties together 
	   	(Taken from jQuery's extend() function)

	    @name util.object_merge
	    @private
	    @function
	    @param Arguments array (not in function declaration)
	    @returns {Object} The merged object
	 */
	util.object_merge = function() {
		var options, name, src, copy, copyis_array, clone,
				target = arguments[0] || {},
				i = 1,
				length = arguments.length,
				deep = false;

			// Handle a deep copy situation
			if ( typeof target === "boolean" ) {
				deep = target;
				target = arguments[1] || {};
				// skip the boolean and the target
				i = 2;
			}

			// Handle case when target is a string or something (possible in deep copy)
			if ( typeof target !== "object" && !util.is_function(target) ) {
				target = {};
			}

			// extend bowtie functions itself if only one argument is passed
			if ( length === i ) {
				target = fn;
				--i;
			}

			for ( ; i < length; i++ ) {
				// Only deal with non-null/undefined values
				if ( (options = arguments[ i ]) != null ) {
					// Extend the base object
					for ( name in options ) {
						src = target[ name ];
						copy = options[ name ];

						// Prevent never-ending loop
						if ( target === copy ) {
							continue;
						}

						// Recurse if we're merging plain objects or arrays
						if ( deep && copy && ( util.is_plain_object(copy) || (copyis_array = util.is_function(copy)) ) ) {
							if ( copyis_array ) {
								copyis_array = false;
								clone = src && util.is_array(src) ? src : [];

							} else {
								clone = src && util.is_plain_object(src) ? src : {};
							}

							// Never move original objects, clone them
							target[ name ] = util.object_merge( deep, clone, copy );

						// Don't bring in undefined values
						} else if ( copy !== undefined ) {
							target[ name ] = copy;
						}
					}
				}
			}

			// Return the modified object
			return target;
	};



	//---------------------------------------------------------------------------------------------
	// Initialization and modifier setup functions


	// push data into the class_types object
	util.for_each("Boolean Number String Function Array Date RegExp Object".split(" "), function($i, $name) {
		class_types[ "[object " + $name + "]" ] = $name.toLowerCase();
	});


	// Below are some plugins (aka modifiers) that are fired during the variable_render phase:

	// comments
	bt.register_plugin('comment', new RegExp('\\%'),  function($var_value) {
		// comments are ignored
		return '';
	});

	// slugify
	bt.register_plugin('slugify', new RegExp('slug\\:'),  function($var_value) {
		if (util.get_type($var_value) !== 'string') {
			return $var_value;
		}
		return util.slugify($var_value);
	});

	// escape quotes
	bt.register_plugin('escape_quotes', new RegExp('escape_quotes\\:'),  function($var_value) {
		return $var_value.replace(/"/g, '&quot;');
	});

	// truncate
	bt.register_plugin('truncate', new RegExp(reg_truncate),  function($var_value) {
		var trim_amount =  this.match(/\(([0-9]{1,100})\)/g);
        if (trim_amount !== null) {
            trim_amount = trim_amount[0].replace(reg_parens, '');
            trim_amount = parseInt(trim_amount);

            var addon = '...';
            if ($var_value.length < trim_amount - 3) {
            	addon = '';
            }

            $var_value =  $var_value.substr(0, trim_amount) + addon;
        }   
        return $var_value;
	});

	// bt_fullname (demo modifier)
	// An example of how to use this like a Handlebars "helper"
	bt.register_plugin('bt_fullname', function($var_value) {
		var firstname = $var_value.first || '';
		var lastname = $var_value.last || '';
		return util.trim(firstname+' '+lastname);
	});



	//---------------------------------------------------------------------------------------------
	// Send bowtie out into the world...

	window.bowtie = bowtie_app();

})( window );