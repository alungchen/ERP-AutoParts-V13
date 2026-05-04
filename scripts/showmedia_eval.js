function ShowMedia(id, str_TableName, str_message, TYPE_LABLE, CHNAME_LABLE)
    {
        var str_url = "../Iframe_MEDIA_List/?KeyValue=" + id + "&TableName=%TableName%&message=%message%&TYPE_LABLE=%TYPE_LABLE%&CHNAME_LABLE=%CHNAME_LABLE%";

        if (typeof(str_message) == "undefined")
            str_message = "";

        str_url = str_url.ReplaceAll("%TableName%", escape(str_TableName));
        str_url = str_url.ReplaceAll("%message%", escape(str_message));

        if (typeof (TYPE_LABLE) != "undefined") {
            str_url = str_url.ReplaceAll("%TYPE_LABLE%", escape(TYPE_LABLE));
        }
        else {
            str_url = str_url.ReplaceAll("%TYPE_LABLE%", "");
        }

        if (typeof (CHNAME_LABLE) != "undefined") {
            str_url = str_url.ReplaceAll("%CHNAME_LABLE%", escape(CHNAME_LABLE));
        }
        else {
            str_url = str_url.ReplaceAll("%CHNAME_LABLE%", "");
        }

        //console.log("ShowMedia str_url", str_url);
        $j("#Iframe_MEDIA_List").attr("src", str_url);
        

        //console.log("ShowMedia_flag", ShowMedia_flag);
        if (ShowMedia_flag != "open") {
            //console.log("click apple_overlay");

            $j("#img_show_media").click();
            ShowMedia_flag = "open";

            
            $j('.apple_overlay .close').click(function () {
                ShowMedia_flag = "";
            });

            setTimeout(function () { $j(window).resize(); }, 500);
        }
        
        
    }