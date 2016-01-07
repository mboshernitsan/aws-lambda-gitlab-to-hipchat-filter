var util = require('util');

var HipChat = require('hipchat-client');

exports.handler = (function(event, context) {
	var activity = event.activity;
	var branches = event.branches ? event.branches.split(',') : [ 'master' ]; // by default, only care about the master branch

	var skip = false, bgcolor = 'yellow', html = null;

	switch (activity.object_kind) {
		case "push":
			var branch = /^refs\/heads\//.test(activity.ref) ? activity.ref.substring("refs/heads/".length) : null;
			if (branch != null && branches.indexOf(branch) == -1) { skip = true; break; } 

			bgcolor = 'yellow';
			html = util.format("%s pushed to %s <a href=%s>%s</a>",
								activity.user_name,
								branch != null ? util.format("branch <a href=%s/commits/%s>%s</a> of", activity.repository.homepage, branch, branch) : '',
								activity.repository.homepage, 
								activity.repository.name);
			for (var i = 0; i < activity.commits.length; i++) {
				var commit = activity.commits[i];
				html += util.format("<br>- %s (<a href=%s>%s</a>)", commit.message, commit.url, commit.id.substring(0, 7));
			}
			break;

		case "note":
			bgcolor = 'gray';

			switch (activity.object_attributes.noteable_type) {
				case "Commit":
					html = util.format("%s commented on <a href=%s>commit %s</a> in <a href=%s>%s</a>: \"%s\"",
										activity.user.name,
										activity.commit.url,
										activity.commit.id.substring(0, 7),										
										activity.repository.homepage, 
										activity.repository.name,
										activity.object_attributes.note);
					break;
				case "MergeRequest":
					html = util.format("%s commented on <a href=%s/merge_requests/%d>merge request #%d</a> (%s) in <a href=%s>%s</a>: \"%s\"",
										activity.user.name,
										activity.repository.homepage, 
										activity.merge_request.iid,
										activity.merge_request.iid,
										activity.merge_request.title,
										activity.repository.homepage, 
										activity.repository.name,
										activity.object_attributes.note);
					break;

				case "Issue":
				case "Snippet":
				default:
					skip = true;
					break;
			}
			break;

		case "merge_request":
			var action_color = { open: 'yellow', merge: 'green', close: 'red' };
			switch (activity.object_attributes.action) { 
				case "open":
				case "merge":
				case "close":
					bgcolor = action_color[activity.object_attributes.action];
					html = util.format("%s %sd <a href=%s/merge_requests/%d>merge request #%d</a> (%s) in <a href=%s>%s</a>",
						activity.user.name,
						activity.object_attributes.action,
						activity.repository.homepage, 
						activity.object_attributes.iid,
						activity.object_attributes.iid,
						activity.object_attributes.title,
						activity.repository.homepage, 
						activity.repository.name);
					break;
				case "update":
				default:
					skip = true;
					break;
			}
			break;

		case "tag_push":
		case "issue":
		default:
			skip = true;
			break;
	}

	if (!html || skip) {
		context.done(null, { "status":"skipped"});
		return;
	}


	// creation message and options
	var msg = {
		from: "GitLab",
		room_id : event.hipchatRoom,
		message_format : "html",
		color : bgcolor,
		notify : false,
		message : html
	};

	var hipchatter = new HipChat(event.hipchatToken);
	
	// send message
	hipchatter.api.rooms.message(msg, function(err, res) {
		context.done(err, res);
	});
});
